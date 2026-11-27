import json

import pytest

from acesso import Catalogo, ProdutoInexistente
from recomendador import treinar
from resumo import DADOS, resumir


def test_consultas_sucesso_vazio_e_erro_no_mesmo_log(tmp_path):
    modelo = tmp_path / "artefato.json"
    modelo.write_text(json.dumps(treinar(json.loads(DADOS.read_text(encoding="utf-8")))))
    log = tmp_path / "uso.jsonl"
    dados = Catalogo(modelo, log)
    origem = "POST /recomendar"
    for alvo in ("p01", "p01", "p14"):
        produto = dados.buscar_peca(alvo, origem)
        dados.buscar_afins(produto, 4, origem)
    with pytest.raises(ProdutoInexistente):
        dados.buscar_peca("texto-livre", origem)

    eventos = [json.loads(linha) for linha in log.read_text().splitlines()]
    assert len(eventos) == 7
    assert eventos[5]["status"] == "sucesso"
    assert eventos[5]["quantidade"] == 0
    assert eventos[6]["parametros"]["produto_id"] == "id_fora_do_formato"
    assert eventos[6]["status"] == "erro"
    resultado = resumir(log, DADOS)
    assert resultado["chamadas"] == {"buscar_peca": 4, "buscar_afins": 3, "listar_pecas": 0}
    assert resultado["consultas_diretas"] == {"p01": 2, "p14": 1}
    assert resultado["motivos"] == {"ProdutoInexistente": 1}
    assert len(resultado["nunca_retornadas"]) == 8
    assert len(dados.listar_pecas("POST /catalogo")) == 14
    assert resumir(log, DADOS)["nunca_retornadas"] == []
