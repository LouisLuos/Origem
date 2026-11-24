from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .catalog_client import fetch_catalog_from_service
from .config import (
    CATALOG_SERVICE_URL,
    CORS_ORIGINS,
    CPU_COUNT,
    DEFAULT_WORKERS,
    MAX_WORKERS,
)
from .engine import (
    ESTRATEGIA,
    compute_batch_digest,
    recommend_batch_parallel,
    recommend_batch_sequential,
    recommend_single_parallel,
    recommend_single_sequential,
)
from .schemas import (
    BatchRecommendationRequest,
    BatchRecommendationResponse,
    HealthResponse,
    ProductOnPage,
    RecommendationItem,
    RecommendationRequest,
    RecommendationResponse,
    ServiceMetrics,
)
from .synthetic import expand_catalog_deterministically

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("recommendation-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pool persistente compatível com Windows (spawn), evitando recriação por requisição.
    app.state.process_pool = ProcessPoolExecutor(max_workers=MAX_WORKERS)
    app.state.http_client = httpx.AsyncClient(timeout=20.0)
    logger.info(
        "Recommendation Service iniciado | cpu_count=%d | default_workers=%d | max_workers=%d | catalog_url=%s",
        CPU_COUNT,
        DEFAULT_WORKERS,
        MAX_WORKERS,
        CATALOG_SERVICE_URL,
    )
    yield
    await app.state.http_client.aclose()
    app.state.process_pool.shutdown(wait=True)


app = FastAPI(
    title="Origem Recommendation Service",
    version="1.0.0",
    description="Serviço independente de recomendação (HU-24) com execução sequencial e paralela via ProcessPoolExecutor.",
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
    detail = exc.detail if isinstance(exc.detail, str) else "Erro no serviço de recomendações."
    return JSONResponse(status_code=exc.status_code, content={"erro": detail})


@app.get("/health", response_model=HealthResponse)
async def health(request: Request):
    pool = getattr(request.app.state, "process_pool", None)
    return HealthResponse(
        status="ok",
        service="recommendation-service",
        cpuCount=CPU_COUNT,
        defaultWorkers=DEFAULT_WORKERS,
        maxWorkers=MAX_WORKERS,
        catalogServiceUrl=CATALOG_SERVICE_URL,
        poolActive=pool is not None,
    )


async def _load_remote_catalog(request: Request):
    client: httpx.AsyncClient = request.app.state.http_client
    try:
        return await fetch_catalog_from_service(client, CATALOG_SERVICE_URL)
    except httpx.HTTPError as exc:
        logger.error("Falha ao consultar Catalog Service (%s): %s", CATALOG_SERVICE_URL, exc)
        raise HTTPException(
            status_code=502,
            detail="Não foi possível obter o catálogo do Catalog Service via HTTP.",
        ) from exc


@app.post("/recommendations", response_model=RecommendationResponse)
async def recommend(body: RecommendationRequest, request: Request):
    total_start = time.perf_counter()
    remote = await _load_remote_catalog(request)

    produtos = remote.produtos
    cestas = remote.cestas
    is_synthetic = False
    data_source = remote.data_source
    if body.synthetic_size is not None:
        produtos, cestas = expand_catalog_deterministically(
            produtos, cestas, target_size=body.synthetic_size, seed=42
        )
        is_synthetic = True
        data_source = f"{remote.data_source}+synthetic_n{body.synthetic_size}"

    requested_workers = (
        1
        if body.mode == "sequential"
        else max(1, min(body.workers or DEFAULT_WORKERS, MAX_WORKERS))
    )

    compute_start = time.perf_counter()
    if body.mode == "sequential":
        result = recommend_single_sequential(
            produtos_raw=produtos,
            cestas=cestas,
            produto_id=body.product_id,
            limite=body.limit,
        )
    else:
        pool: ProcessPoolExecutor = request.app.state.process_pool
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            recommend_single_parallel,
            produtos,
            cestas,
            body.product_id,
            pool,
            requested_workers,
            body.limit,
        )
    compute_ms = round((time.perf_counter() - compute_start) * 1000, 3)

    if "erro" in result:
        raise HTTPException(
            status_code=404, detail=f"produto_inexistente: {body.product_id}"
        )

    total_ms = round((time.perf_counter() - total_start) * 1000, 3)
    return RecommendationResponse(
        produto_na_pagina=ProductOnPage(**result["produto_na_pagina"]),
        items=[RecommendationItem(**item) for item in result["items"]],
        estrategia=result["estrategia"],
        metrics=ServiceMetrics(
            mode=body.mode,
            workers=requested_workers,
            compute_ms=compute_ms,
            catalog_fetch_ms=remote.catalog_fetch_ms,
            total_ms=total_ms,
            catalog_size=len(produtos),
            processed_targets=1,
            data_source=data_source,
            is_synthetic=is_synthetic,
        ),
    )


@app.post("/recommendations/batch", response_model=BatchRecommendationResponse)
async def recommend_batch(body: BatchRecommendationRequest, request: Request):
    total_start = time.perf_counter()
    remote = await _load_remote_catalog(request)

    produtos = remote.produtos
    cestas = remote.cestas
    is_synthetic = False
    data_source = remote.data_source
    if body.synthetic_size is not None:
        produtos, cestas = expand_catalog_deterministically(
            produtos, cestas, target_size=body.synthetic_size, seed=42
        )
        is_synthetic = True
        data_source = f"{remote.data_source}+synthetic_n{body.synthetic_size}"

    target_ids = [str(p["id"]) for p in produtos]
    if body.batch_size is not None:
        target_ids = target_ids[: body.batch_size]

    requested_workers = (
        1
        if body.mode == "sequential"
        else max(1, min(body.workers or DEFAULT_WORKERS, MAX_WORKERS))
    )

    compute_start = time.perf_counter()
    if body.mode == "sequential":
        batch_map = recommend_batch_sequential(
            produtos_raw=produtos,
            cestas=cestas,
            target_ids=target_ids,
            limite=body.limit,
        )
    else:
        pool: ProcessPoolExecutor = request.app.state.process_pool
        loop = asyncio.get_running_loop()
        batch_map = await loop.run_in_executor(
            None,
            recommend_batch_parallel,
            produtos,
            cestas,
            pool,
            requested_workers,
            target_ids,
            body.limit,
        )
    compute_ms = round((time.perf_counter() - compute_start) * 1000, 3)

    # Fingerprint the actual ordered workload outside the compute timer.
    workload = json.dumps([produtos, cestas, target_ids, body.limit], sort_keys=True, separators=(",", ":"))
    input_digest = hashlib.sha256(workload.encode("utf-8")).hexdigest()
    digest = compute_batch_digest(batch_map)
    sample_keys = target_ids[:3]
    sample_results = {
        k: [RecommendationItem(**it) for it in batch_map[k]]
        for k in sample_keys
    }
    total_ms = round((time.perf_counter() - total_start) * 1000, 3)

    return BatchRecommendationResponse(
        estrategia=ESTRATEGIA,
        sample_results=sample_results,
        result_digest=digest,
        input_digest=input_digest,
        metrics=ServiceMetrics(
            mode=body.mode,
            workers=requested_workers,
            compute_ms=compute_ms,
            catalog_fetch_ms=remote.catalog_fetch_ms,
            total_ms=total_ms,
            catalog_size=len(produtos),
            processed_targets=len(target_ids),
            data_source=data_source,
            is_synthetic=is_synthetic,
        ),
    )
