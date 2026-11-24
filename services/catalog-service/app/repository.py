from __future__ import annotations

import json
import logging
import math
import time
import uuid
from dataclasses import dataclass
from typing import Any

import psycopg

from .config import DATA_FILE, POSTGRES_DSN, USE_POSTGRES
from .schemas import ArtesaoPublico, PaginationMeta, ProdutoPublico
from .taxonomy import build_artisan_id, format_technique

logger = logging.getLogger("catalog-service.repository")

SQL_PECAS_PUBLICADAS = """
SELECT
    p.id::text AS id,
    p.atelie_id::text AS atelie_id,
    p.titulo AS titulo,
    p.descricao AS descricao,
    p.tipologia AS tipologia,
    p.preco::float8 AS preco,
    p.quantidade_estoque AS quantidade_estoque,
    p.status::text AS status,
    a.polo_cultural AS polo_cultural,
    art.id::text AS artesao_id,
    u.nome AS artesao_nome,
    COALESCE(
        ARRAY_AGG(fp.url ORDER BY fp.is_principal DESC, fp.ordem ASC)
        FILTER (WHERE fp.url IS NOT NULL),
        ARRAY[]::text[]
    ) AS fotos
FROM pecas p
JOIN atelies a ON a.id = p.atelie_id
JOIN artesaos art ON art.id = a.artesao_id
JOIN usuarios u ON u.id = art.usuario_id
LEFT JOIN fotos_peca fp ON fp.peca_id = p.id
WHERE p.status::text IN ('DISPONIVEL', 'RESERVADA', 'VENDIDA')
GROUP BY
    p.id, p.atelie_id, p.titulo, p.descricao, p.tipologia, p.preco,
    p.quantidade_estoque, p.status, a.polo_cultural, art.id, u.nome, p.criado_em
ORDER BY p.criado_em DESC;
"""

SQL_ARTESAOS_ATIVOS = """
SELECT
    art.id::text AS id,
    u.nome AS nome,
    COALESCE(a.polo_cultural, '') AS polo_cultural,
    COALESCE(a.nome_comercial, u.nome) AS nome_comercial,
    COALESCE(art.tecnica_principal, '') AS tecnica_principal,
    art.biografia_cultural AS biografia_cultural,
    art.ano_inicio AS ano_inicio,
    COALESCE(art.foto_url, '') AS foto_url,
    COALESCE(art.foto_alt, u.nome) AS foto_alt,
    COALESCE(art.cover_url, '') AS cover_url,
    COALESCE(art.cover_alt, COALESCE(a.nome_comercial, u.nome)) AS cover_alt
FROM artesaos art
JOIN usuarios u ON u.id = art.usuario_id
LEFT JOIN atelies a ON a.artesao_id = art.id
WHERE u.status = 'ATIVO'
ORDER BY art.criado_em DESC;
"""


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError):
        return False


@dataclass(frozen=True)
class CatalogSnapshot:
    produtos: list[ProdutoPublico]
    artesaos: list[ArtesaoPublico]
    cestas: list[list[str]]
    data_source: str
    db_connected: bool


class CatalogRepository:
    """Repositório híbrido: PostgreSQL em modo estritamente somente-leitura + fallback/complemento JSON."""

    def __init__(self, cache_ttl_seconds: float = 10.0) -> None:
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cached_snapshot: CatalogSnapshot | None = None
        self._cached_at: float = 0.0

    def _load_local_payload(self) -> dict[str, Any]:
        raw = DATA_FILE.read_text(encoding="utf-8")
        return json.loads(raw)

    def _map_local_product(self, item: dict[str, Any]) -> ProdutoPublico:
        artisan_name = str(item["artesao"]).strip()
        artisan_id = build_artisan_id(artisan_name)
        product_id = str(item["id"])
        nome = str(item["nome"])
        tecnica = format_technique(str(item["tecnica"]))
        polo = str(item["polo"])
        categoria = item.get("categoria")
        return ProdutoPublico(
            id=product_id,
            title=nome,
            artisan=artisan_name,
            artisanId=artisan_id,
            hub=polo,
            technique=tecnica,
            category=str(categoria) if categoria else None,
            price=float(item["preco"]),
            stock=int(item["estoque"]),
            active=True,
            imageUrl=f"https://picsum.photos/seed/origem-{product_id}/800/800",
            imageAlt=nome,
            description=f"{nome}, produzido em {polo} pela técnica tradicional de {tecnica.lower()}.",
        )

    def _fetch_postgres_readonly(self) -> tuple[list[ProdutoPublico], list[ArtesaoPublico]] | None:
        if not USE_POSTGRES or not POSTGRES_DSN:
            return None

        try:
            with psycopg.connect(POSTGRES_DSN, connect_timeout=4) as conn:
                with conn.cursor() as cur:
                    cur.execute("BEGIN READ ONLY")
                    cur.execute(SQL_PECAS_PUBLICADAS)
                    pecas_rows = cur.fetchall()

                    cur.execute(SQL_ARTESAOS_ATIVOS)
                    artesaos_rows = cur.fetchall()
                    conn.commit()
        except Exception as exc:
            logger.warning(
                "PostgreSQL indisponível (%s); operando em modo local com catalogo.json.",
                type(exc).__name__,
            )
            return None

        db_products: list[ProdutoPublico] = []
        for row in pecas_rows:
            (
                pid,
                atelie_id,
                titulo,
                descricao,
                tipologia,
                preco,
                qtd_estoque,
                status,
                polo,
                artesao_id,
                artesao_nome,
                fotos,
            ) = row
            gallery = [str(url) for url in (fotos or []) if url]
            stock_visivel = int(qtd_estoque) if status == "DISPONIVEL" else 0
            db_products.append(
                ProdutoPublico(
                    id=pid,
                    atelieId=atelie_id,
                    status=status,
                    title=titulo,
                    artisan=artesao_nome.strip(),
                    artisanId=artesao_id,
                    hub=polo,
                    technique=tipologia,
                    category=None,
                    price=float(preco),
                    stock=stock_visivel,
                    active=True,
                    imageUrl=gallery[0] if gallery else f"https://picsum.photos/seed/origem-{pid}/800/800",
                    imageAlt=titulo,
                    description=descricao,
                    gallery=gallery or None,
                )
            )

        db_artisans: list[ArtesaoPublico] = []
        for row in artesaos_rows:
            (
                aid,
                nome,
                polo,
                _nome_comercial,
                tecnica,
                bio,
                ano_inicio,
                foto_url,
                foto_alt,
                cover_url,
                cover_alt,
            ) = row
            slug_id = build_artisan_id(nome)
            db_artisans.append(
                ArtesaoPublico(
                    id=aid,
                    name=nome.strip(),
                    hub=polo,
                    technique=tecnica,
                    bio=bio or "",
                    since=ano_inicio,
                    photoUrl=foto_url or f"https://picsum.photos/seed/{slug_id}/600/700",
                    photoAlt=foto_alt,
                    coverUrl=cover_url or f"https://picsum.photos/seed/atelie-{slug_id}/1600/500",
                    coverAlt=cover_alt,
                    pieces=[],
                )
            )

        return db_products, db_artisans

    def get_snapshot(self, force_refresh: bool = False) -> CatalogSnapshot:
        now = time.monotonic()
        if (
            not force_refresh
            and self._cached_snapshot is not None
            and (now - self._cached_at) < self._cache_ttl_seconds
        ):
            return self._cached_snapshot

        payload = self._load_local_payload()
        local_products = [self._map_local_product(p) for p in payload.get("produtos", [])]
        cestas = [[str(pid) for pid in cesta] for cesta in payload.get("cestas", [])]

        db_result = self._fetch_postgres_readonly()
        if db_result is not None:
            db_products, db_artisans = db_result
            merged_products = [*db_products, *local_products]
            data_source = "postgresql_read_only+local_json"
            db_connected = True
        else:
            db_artisans = []
            merged_products = local_products
            data_source = "local_json_only"
            db_connected = False

        merged_artisans = self._merge_artisans(db_artisans, local_products, merged_products)
        snapshot = CatalogSnapshot(
            produtos=merged_products,
            artesaos=merged_artisans,
            cestas=cestas,
            data_source=data_source,
            db_connected=db_connected,
        )
        self._cached_snapshot = snapshot
        self._cached_at = now
        return snapshot

    def _merge_artisans(
        self,
        db_artisans: list[ArtesaoPublico],
        local_products: list[ProdutoPublico],
        all_products: list[ProdutoPublico],
    ) -> list[ArtesaoPublico]:
        seen_slugs = {build_artisan_id(a.name) for a in db_artisans}
        artisans = list(db_artisans)

        for product in local_products:
            slug = build_artisan_id(product.artisan)
            if slug in seen_slugs:
                continue
            seen_slugs.add(slug)
            artisans.append(
                ArtesaoPublico(
                    id=slug,
                    name=product.artisan,
                    hub=product.hub,
                    technique=product.technique,
                    bio=f"Mestre artesão de {product.hub}, referência em {product.technique.lower()} no artesanato pernambucano.",
                    since=None,
                    photoUrl=f"https://picsum.photos/seed/{slug}/600/700",
                    photoAlt=product.artisan,
                    coverUrl=f"https://picsum.photos/seed/atelie-{slug}/1600/500",
                    coverAlt=f"Ateliê de {product.artisan}",
                    pieces=[],
                )
            )

        pieces_by_artisan_id: dict[str, list[ProdutoPublico]] = {}
        pieces_by_slug: dict[str, list[ProdutoPublico]] = {}
        for prod in all_products:
            pieces_by_artisan_id.setdefault(prod.artisanId, []).append(prod)
            pieces_by_slug.setdefault(build_artisan_id(prod.artisan), []).append(prod)

        enriched: list[ArtesaoPublico] = []
        for artisan in artisans:
            pieces = (
                pieces_by_artisan_id.get(artisan.id)
                or pieces_by_slug.get(build_artisan_id(artisan.name))
                or []
            )
            technique = artisan.technique or (pieces[0].technique if pieces else "")
            enriched.append(
                artisan.model_copy(update={"technique": technique, "pieces": pieces})
            )
        return enriched

    def list_products(
        self,
        page: int = 1,
        limit: int = 10,
        technique: str | None = None,
        hub: str | None = None,
    ) -> tuple[list[ProdutoPublico], PaginationMeta, str]:
        snapshot = self.get_snapshot()
        items = snapshot.produtos
        if technique:
            tech_lower = technique.strip().lower()
            items = [p for p in items if p.technique.lower() == tech_lower]
        if hub:
            hub_lower = hub.strip().lower()
            items = [p for p in items if p.hub.lower() == hub_lower]

        paged, meta = paginate(items, page=page, limit=limit)
        return paged, meta, snapshot.data_source

    def get_product_by_id(self, product_id: str) -> tuple[ProdutoPublico | None, str]:
        snapshot = self.get_snapshot()
        for prod in snapshot.produtos:
            if prod.id == product_id:
                return prod, snapshot.data_source
        return None, snapshot.data_source

    def list_artisans(
        self, page: int = 1, limit: int = 10
    ) -> tuple[list[ArtesaoPublico], PaginationMeta, str]:
        snapshot = self.get_snapshot()
        paged, meta = paginate(snapshot.artesaos, page=page, limit=limit)
        return paged, meta, snapshot.data_source

    def get_artisan_by_id(self, artisan_id: str) -> tuple[ArtesaoPublico | None, str]:
        snapshot = self.get_snapshot()
        for artisan in snapshot.artesaos:
            if artisan.id == artisan_id:
                return artisan, snapshot.data_source
        if _is_uuid(artisan_id):
            return None, snapshot.data_source
        return None, snapshot.data_source


def paginate(
    items: list[Any], page: int = 1, limit: int = 10
) -> tuple[list[Any], PaginationMeta]:
    total_itens = len(items)
    safe_page = max(1, page)
    safe_limit = max(1, limit)
    total_paginas = max(1, math.ceil(total_itens / safe_limit))
    start = (safe_page - 1) * safe_limit
    dados = items[start : start + safe_limit]
    return dados, PaginationMeta(
        totalItens=total_itens,
        paginaAtual=safe_page,
        totalPaginas=total_paginas,
        itensPorPagina=safe_limit,
    )


catalog_repository = CatalogRepository()
