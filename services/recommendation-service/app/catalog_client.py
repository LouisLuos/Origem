from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger("recommendation-service.catalog_client")


@dataclass(frozen=True)
class RemoteCatalogData:
    produtos: list[dict[str, Any]]
    cestas: list[list[str]]
    data_source: str
    catalog_fetch_ms: float


async def fetch_catalog_from_service(
    client: httpx.AsyncClient,
    catalog_service_url: str,
) -> RemoteCatalogData:
    """Consome produtos e cestas do Catalog Service exclusivamente via HTTP/REST."""
    produtos_url = f"{catalog_service_url}/api/v1/produtos?limit=2000"
    cestas_url = f"{catalog_service_url}/api/v1/cestas"

    logger.info("OUTBOUND HTTP GET %s & %s", produtos_url, cestas_url)
    started = time.perf_counter()

    prod_resp, cestas_resp = await asyncio.gather(
        client.get(produtos_url),
        client.get(cestas_url),
    )
    fetch_ms = round((time.perf_counter() - started) * 1000, 3)

    prod_resp.raise_for_status()
    cestas_resp.raise_for_status()

    prod_payload = prod_resp.json()
    cestas_payload = cestas_resp.json()

    return RemoteCatalogData(
        produtos=prod_payload.get("dados", []),
        cestas=cestas_payload.get("cestas", []),
        data_source=str(prod_payload.get("dataSource", "remote_http")),
        catalog_fetch_ms=fetch_ms,
    )
