from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import CORS_ORIGINS, RECOMMENDATION_SERVICE_URL
from .repository import catalog_repository
from .schemas import (
    ArtesaoPublico,
    CestasResponse,
    HealthResponse,
    PaginatedArtesaos,
    PaginatedProdutos,
    ProductSummary,
    ProdutoPublico,
    RecommendationGatewayResponse,
    RecommendationItemPublico,
    RecommendationMetrics,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("catalog-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=20.0)
    snapshot = catalog_repository.get_snapshot(force_refresh=True)
    logger.info(
        "Catalog Service iniciado | data_source=%s | products=%d | artisans=%d | recommendation_url=%s",
        snapshot.data_source,
        len(snapshot.produtos),
        len(snapshot.artesaos),
        RECOMMENDATION_SERVICE_URL,
    )
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title="Origem Catalog Service",
    version="1.0.0",
    description="Serviço independente de catálogo de produtos e artesãos do Origem (FastAPI).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_http_requests(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "HTTP %s %s -> %d (%.2f ms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else "Não foi possível concluir a requisição."
    return JSONResponse(status_code=exc.status_code, content={"erro": detail})


@app.get("/api/v1/health", response_model=HealthResponse)
async def health():
    snapshot = catalog_repository.get_snapshot()
    return HealthResponse(
        status="ok",
        service="catalog-service",
        dataSource=snapshot.data_source,
        dbConnected=snapshot.db_connected,
        totalProducts=len(snapshot.produtos),
        totalArtisans=len(snapshot.artesaos),
        recommendationServiceUrl=RECOMMENDATION_SERVICE_URL,
    )


@app.get("/api/v1/produtos", response_model=PaginatedProdutos)
async def listar_produtos(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=2000),
    technique: str | None = Query(default=None),
    hub: str | None = Query(default=None),
):
    dados, meta, data_source = catalog_repository.list_products(
        page=page, limit=limit, technique=technique, hub=hub
    )
    return PaginatedProdutos(dados=dados, meta=meta, dataSource=data_source)


@app.get("/api/v1/produtos/{product_id}", response_model=ProdutoPublico)
async def detalhar_produto(product_id: str):
    produto, _ = catalog_repository.get_product_by_id(product_id)
    if not produto:
        raise HTTPException(
            status_code=404, detail=f"Produto com id '{product_id}' não encontrado."
        )
    return produto


@app.get("/api/v1/cestas", response_model=CestasResponse)
async def listar_cestas():
    snapshot = catalog_repository.get_snapshot()
    return CestasResponse(cestas=snapshot.cestas, dataSource=snapshot.data_source)


@app.get("/api/v1/artesaos", response_model=PaginatedArtesaos)
async def listar_artesaos(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=500),
):
    dados, meta, data_source = catalog_repository.list_artisans(page=page, limit=limit)
    return PaginatedArtesaos(dados=dados, meta=meta, dataSource=data_source)


@app.get("/api/v1/artesaos/{artisan_id}", response_model=ArtesaoPublico)
async def detalhar_artesao(artisan_id: str):
    artesao, _ = catalog_repository.get_artisan_by_id(artisan_id)
    if not artesao:
        raise HTTPException(
            status_code=404, detail=f"Artesão com id '{artisan_id}' não encontrado."
        )
    return artesao


@app.get(
    "/api/v1/produtos/{product_id}/recomendacoes",
    response_model=RecommendationGatewayResponse,
)
async def recomendar_para_produto(
    product_id: str,
    request: Request,
    limit: int = Query(default=4, ge=1, le=6),
    mode: Literal["sequential", "parallel"] = Query(default="parallel"),
    workers: int | None = Query(default=None, ge=1, le=16),
):
    snapshot = catalog_repository.get_snapshot()
    product_map = {p.id: p for p in snapshot.produtos}
    target = product_map.get(product_id)
    if not target:
        raise HTTPException(
            status_code=404, detail=f"Produto com id '{product_id}' não encontrado."
        )

    client: httpx.AsyncClient = request.app.state.http_client
    payload: dict[str, object] = {
        "product_id": product_id,
        "limit": limit,
        "mode": mode,
    }
    if workers is not None:
        payload["workers"] = workers

    url = f"{RECOMMENDATION_SERVICE_URL}/recommendations"
    logger.info(
        "OUTBOUND HTTP POST %s | product_id=%s mode=%s workers=%s",
        url,
        product_id,
        mode,
        workers,
    )
    gw_start = time.perf_counter()
    try:
        resp = await client.post(url, json=payload)
    except httpx.RequestError as exc:
        logger.error("Falha na comunicação HTTP com Recommendation Service: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Serviço de recomendações indisponível no momento. Verifique se o serviço está ativo na porta 3002.",
        ) from exc
    gateway_http_ms = round((time.perf_counter() - gw_start) * 1000, 3)

    if resp.status_code == 404:
        raise HTTPException(
            status_code=404, detail=f"Produto com id '{product_id}' não encontrado."
        )
    if resp.status_code >= 400:
        logger.error(
            "Recommendation Service retornou HTTP %d: %s", resp.status_code, resp.text
        )
        raise HTTPException(
            status_code=502,
            detail="Não foi possível obter recomendações do serviço distribuído.",
        )

    rec_data = resp.json()
    enriched_items: list[RecommendationItemPublico] = []
    for raw_item in rec_data.get("items", []):
        base = product_map.get(raw_item["product_id"])
        if base is None:
            continue
        enriched_items.append(
            RecommendationItemPublico(
                **base.model_dump(),
                rank=raw_item["rank"],
                score=raw_item["score"],
                similaridade=raw_item["similaridade"],
                coocorrencia=raw_item["coocorrencia"],
                motivos=raw_item["motivos"],
            )
        )

    rec_metrics = rec_data["metrics"]
    total_ms = round(gateway_http_ms, 3)

    return RecommendationGatewayResponse(
        produtoNaPagina=ProductSummary(
            productId=target.id,
            title=target.title,
            technique=target.technique,
            hub=target.hub,
        ),
        items=enriched_items,
        estrategia=rec_data["estrategia"],
        metrics=RecommendationMetrics(
            mode=rec_metrics["mode"],
            workers=rec_metrics["workers"],
            computeMs=rec_metrics["compute_ms"],
            catalogFetchMs=rec_metrics["catalog_fetch_ms"],
            gatewayHttpMs=gateway_http_ms,
            totalMs=total_ms,
            catalogSize=rec_metrics["catalog_size"],
            dataSource=rec_metrics["data_source"],
            isSynthetic=rec_metrics.get("is_synthetic", False),
        ),
    )



@app.post("/api/v1/laboratorio/amostra")
async def medir_lote(
    request: Request,
    mode: Literal["sequential", "parallel"],
    workers: int = Query(ge=1, le=8),
    size: int | None = None,
):
    if size not in (None, 200, 500, 1000):
        raise HTTPException(422, "Volume de catálogo inválido.")
    if workers not in ((1,) if mode == "sequential" else (2, 4, 8)):
        raise HTTPException(422, "Quantidade de workers inválida para este modo.")

    payload = {"mode": mode, "workers": workers, "limit": 4, "synthetic_size": size}
    started = time.perf_counter()
    try:
        upstream = await request.app.state.http_client.post(
            f"{RECOMMENDATION_SERVICE_URL}/recommendations/batch", json=payload
        )
        upstream.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(503, "O serviço de recomendações não concluiu o lote.") from exc

    gateway_ms = (time.perf_counter() - started) * 1000
    batch = upstream.json()
    return {
        **batch["metrics"],
        "gateway_ms": gateway_ms,
        "result_digest": batch["result_digest"],
        "input_digest": batch["input_digest"],
    }
