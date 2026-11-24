"""Regressões da verificação de equivalência por amostra na CLI."""

import json

import httpx
import pytest

import benchmark_recommendations as benchmark


def test_algoritmo_rejeita_divergencia_intermediaria(monkeypatch):
    monkeypatch.setattr(benchmark.os, "cpu_count", lambda: 1)
    monkeypatch.setattr(benchmark, "expand_catalog_deterministically", lambda *args, **kwargs: ([], []))
    # A primeira e a última medição coincidem; apenas a segunda diverge.
    resultados = iter([{}, {}, {"inesperado": []}, {}])
    monkeypatch.setattr(benchmark, "recommend_batch_sequential", lambda *args, **kwargs: next(resultados))

    with pytest.raises(AssertionError, match="original_n0, workers=1, amostra 3"):
        benchmark.run_algorithmic_benchmark([], [], "teste", repeats=3, warmups=1)


@pytest.mark.parametrize("campo", ["input_digest", "result_digest"])
@pytest.mark.parametrize("amostra", [1, 3])
def test_lote_http_confere_aquecimento_e_medicoes(monkeypatch, campo, amostra):
    monkeypatch.setattr(benchmark.os, "cpu_count", lambda: 2)
    paralelas = 0

    def responder(request):
        nonlocal paralelas
        metrics = {"catalog_size": 15, "data_source": "local_json_only", "compute_ms": 1, "catalog_fetch_ms": 2}
        if request.method == "GET":
            return httpx.Response(200, json={"items": [], "metrics": {
                "computeMs": 1, "catalogFetchMs": 2, "gatewayHttpMs": 3,
                "dataSource": "local_json_only", "catalogSize": 15,
            }})
        body = {"input_digest": "a" * 64, "result_digest": "b" * 64, "metrics": metrics}
        if json.loads(request.content)["mode"] == "parallel":
            paralelas += 1
            if paralelas == amostra:
                body[campo] = "c" * 64
        return httpx.Response(200, json=body)

    client = httpx.Client(transport=httpx.MockTransport(responder))
    monkeypatch.setattr(benchmark.httpx, "Client", lambda **kwargs: client)
    with pytest.raises(AssertionError, match=f"original, workers=2, amostra {amostra}"):
        benchmark.run_http_e2e_benchmark("http://catalog", "http://recommendation", repeats=3, warmups=1)
