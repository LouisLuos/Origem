from __future__ import annotations

import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
from fastapi.testclient import TestClient

SERVICE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVICE_ROOT.parent.parent
CATALOG_JSON = REPO_ROOT / "services" / "catalog-service" / "data" / "catalogo.json"

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.catalog_client import RemoteCatalogData  # noqa: E402
from app.engine import (  # noqa: E402
    compute_batch_digest,
    recommend_batch_parallel,
    recommend_batch_sequential,
    recommend_single_parallel,
    recommend_single_sequential,
)
from app.main import app  # noqa: E402
from app.synthetic import expand_catalog_deterministically  # noqa: E402


def _load_fixture_catalog() -> tuple[list[dict], list[list[str]]]:
    payload = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    return payload["produtos"], payload["cestas"]


def test_hu24_ct01_ct02_ct03_and_sequential_vs_parallel_equivalence():
    produtos, cestas = _load_fixture_catalog()

    with ProcessPoolExecutor(max_workers=2) as pool:
        # CT-01: p01 exclui p01 e p03 (esgotada), retorna top 4
        seq_p01 = recommend_single_sequential(produtos, cestas, "p01", limite=4)
        par_p01 = recommend_single_parallel(produtos, cestas, "p01", pool, workers=2, limite=4)
        assert seq_p01 == par_p01
        ids_p01 = [item["product_id"] for item in seq_p01["items"]]
        assert ids_p01 == ["p02", "p04", "p06", "p05"]
        assert "p01" not in ids_p01
        assert "p03" not in ids_p01

        # CT-02: p07 prioriza p08 por coocorrencia
        seq_p07 = recommend_single_sequential(produtos, cestas, "p07", limite=4)
        par_p07 = recommend_single_parallel(produtos, cestas, "p07", pool, workers=2, limite=4)
        assert seq_p07 == par_p07
        assert [item["product_id"] for item in seq_p07["items"]] == ["p08", "p09", "p10"]
        assert "comprados_juntos" in seq_p07["items"][0]["motivos"]

        # CT-03: produto inexistente
        missing = recommend_single_sequential(produtos, cestas, "nao-existe", limite=4)
        assert missing["erro"] == "produto_inexistente"

        # Lote em catálogo sintético expandido: equivalência exata entre 1 e 2/4 processos
        syn_prod, syn_cestas = expand_catalog_deterministically(
            produtos, cestas, target_size=80, seed=42
        )
        batch_seq = recommend_batch_sequential(syn_prod, syn_cestas, limite=4)
        batch_par = recommend_batch_parallel(syn_prod, syn_cestas, pool, workers=2, limite=4)
        assert compute_batch_digest(batch_seq) == compute_batch_digest(batch_par)


def test_http_endpoints_and_catalog_service_error_handling(monkeypatch):
    produtos, cestas = _load_fixture_catalog()

    async def fake_fetch(_client, _url):
        return RemoteCatalogData(
            produtos=produtos,
            cestas=cestas,
            data_source="local_json_only",
            catalog_fetch_ms=1.5,
        )

    monkeypatch.setattr("app.main.fetch_catalog_from_service", fake_fetch)

    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["poolActive"] is True

        rec_seq = client.post(
            "/recommendations",
            json={"product_id": "p01", "limit": 4, "mode": "sequential"},
        )
        rec_par = client.post(
            "/recommendations",
            json={"product_id": "p01", "limit": 4, "mode": "parallel", "workers": 2},
        )
        assert rec_seq.status_code == 200
        assert rec_par.status_code == 200
        assert rec_seq.json()["items"] == rec_par.json()["items"]

        batch_seq = client.post(
            "/recommendations/batch",
            json={"mode": "sequential", "synthetic_size": 60, "limit": 4},
        )
        batch_par = client.post(
            "/recommendations/batch",
            json={"mode": "parallel", "workers": 2, "synthetic_size": 60, "limit": 4},
        )
        assert batch_seq.status_code == 200
        assert batch_par.status_code == 200
        assert batch_seq.json()["input_digest"] == batch_par.json()["input_digest"]
        assert batch_seq.json()["result_digest"] == batch_par.json()["result_digest"]
        assert batch_par.json()["metrics"]["is_synthetic"] is True

        missing = client.post(
            "/recommendations",
            json={"product_id": "nao-existe", "mode": "sequential"},
        )
        assert missing.status_code == 404

    async def failing_fetch(_client, _url):
        raise httpx.ConnectError("catalog service offline")

    monkeypatch.setattr("app.main.fetch_catalog_from_service", failing_fetch)
    with TestClient(app) as client:
        err = client.post(
            "/recommendations",
            json={"product_id": "p01", "mode": "sequential"},
        )
        assert err.status_code == 502
        assert "erro" in err.json()
