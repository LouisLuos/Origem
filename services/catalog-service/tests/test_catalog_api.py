from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
from fastapi.testclient import TestClient

SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.main import app  # noqa: E402


def test_health_and_catalog_endpoints():
    with TestClient(app) as client:
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        health_body = health.json()
        assert health_body["status"] == "ok"
        assert health_body["service"] == "catalog-service"
        assert health_body["dataSource"] in {
            "postgresql_read_only+local_json",
            "local_json_only",
        }
        assert health_body["totalProducts"] >= 14

        produtos = client.get("/api/v1/produtos?limit=100")
        assert produtos.status_code == 200
        dados = produtos.json()["dados"]
        assert any(item["id"] == "p01" for item in dados)

        filtrados = client.get("/api/v1/produtos?technique=Xilogravura&hub=Bezerros")
        assert filtrados.status_code == 200
        assert all(
            item["technique"] == "Xilogravura" and item["hub"] == "Bezerros"
            for item in filtrados.json()["dados"]
        )

        detalhe = client.get("/api/v1/produtos/p01")
        assert detalhe.status_code == 200
        assert detalhe.json()["id"] == "p01"

        ausente = client.get("/api/v1/produtos/nao-existe")
        assert ausente.status_code == 404
        assert "erro" in ausente.json()

        cestas = client.get("/api/v1/cestas")
        assert cestas.status_code == 200
        assert len(cestas.json()["cestas"]) >= 10

        artesaos = client.get("/api/v1/artesaos?limit=100")
        assert artesaos.status_code == 200
        assert len(artesaos.json()["dados"]) >= 5


def test_recommendations_gateway_calls_http_and_never_silently_fallbacks():
    with TestClient(app) as client:
        mock_response = httpx.Response(
            200,
            json={
                "produto_na_pagina": {
                    "product_id": "p01",
                    "nome": "Boneco de barro Vitalino (réplica)",
                    "tecnica": "Cerâmica Figurativa",
                    "polo": "Alto do Moura",
                },
                "items": [
                    {
                        "rank": 1,
                        "product_id": "p02",
                        "nome": "Cena de forró em barro",
                        "artesao": "Mestre Severino",
                        "tecnica": "Cerâmica Figurativa",
                        "polo": "Alto do Moura",
                        "preco": 260.0,
                        "score": 0.91,
                        "similaridade": 0.85,
                        "coocorrencia": 1.0,
                        "motivos": ["mesma_tecnica", "mesmo_polo", "comprados_juntos"],
                    }
                ],
                "estrategia": "cosseno_conteudo+coocorrencia",
                "metrics": {
                    "mode": "parallel",
                    "workers": 2,
                    "compute_ms": 1.25,
                    "catalog_fetch_ms": 2.4,
                    "total_ms": 3.65,
                    "catalog_size": 14,
                    "processed_targets": 1,
                    "data_source": "local_json_only",
                    "is_synthetic": False,
                },
            },
        )
        app.state.http_client.post = AsyncMock(return_value=mock_response)

        ok_resp = client.get("/api/v1/produtos/p01/recomendacoes?limit=4&mode=parallel&workers=2")
        assert ok_resp.status_code == 200
        body = ok_resp.json()
        assert body["items"][0]["id"] == "p02"
        assert body["items"][0]["imageUrl"].startswith("https://")
        assert body["metrics"]["mode"] == "parallel"
        assert body["metrics"]["workers"] == 2

        # Se o serviço de recomendações cair, deve retornar erro HTTP 503 explícito (sem fallback local)
        app.state.http_client.post = AsyncMock(
            side_effect=httpx.ConnectError("connection refused")
        )
        err_resp = client.get("/api/v1/produtos/p01/recomendacoes?mode=parallel")
        assert err_resp.status_code == 503
        assert "erro" in err_resp.json()
