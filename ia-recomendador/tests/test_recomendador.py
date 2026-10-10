"""Testes da lógica da HU-24 (rodam sem subir o servidor)."""

import json
from pathlib import Path

import pytest

import recomendador

CATALOGO = Path(__file__).resolve().parents[1] / "dados" / "catalogo.json"


@pytest.fixture(scope="module")
def artefato():
    return recomendador.treinar(json.loads(CATALOGO.read_text(encoding="utf-8")))


def ids(resposta):
    return [item["product_id"] for item in resposta["items"]]


def test_cenario1_mesma_tecnica_ou_polo_sem_propria_peca_e_sem_esgotado(artefato):
    resposta = recomendador.recomendar(artefato, "p01")

    assert ids(resposta) == ["p02", "p04", "p06", "p05"]
    assert "p01" not in ids(resposta)
    assert "p03" not in ids(resposta)  # cerâmica do Alto do Moura, mas estoque 0
    for item in resposta["items"]:
        assert item["tecnica"] == "ceramica" or item["polo"] == "Alto do Moura"


def test_cenario2_comprados_juntos_tem_prioridade(artefato):
    resposta = recomendador.recomendar(artefato, "p07")
    p08, p09 = resposta["items"][0], resposta["items"][1]

    assert (p08["product_id"], p09["product_id"]) == ("p08", "p09")
    # p09 é mais parecida por conteúdo, mas p08 sai junto com p07 com mais frequência.
    assert p09["similaridade"] > p08["similaridade"]
    assert "comprados_juntos" in p08["motivos"]


def test_produto_inexistente(artefato):
    resposta = recomendador.recomendar(artefato, "nao-existe")

    assert resposta["erro"] == "produto_inexistente"
    assert resposta["items"] == []


@pytest.mark.parametrize("pedido, maximo", [(0, 1), (2, 2), (99, 6)])
def test_limite_fica_entre_1_e_6(artefato, pedido, maximo):
    resposta = recomendador.recomendar(artefato, "p01", pedido)
    assert 1 <= len(resposta["items"]) <= maximo
