"""Etapa online: serviço BentoML do módulo de recomendação do Origem."""

from __future__ import annotations

import bentoml
from bentoml.exceptions import NotFound

import recomendador
from acesso import Catalogo, ProdutoInexistente

modelo = bentoml.models.get("origem-recomendador:latest")
ARTEFATO = "artefato.json"


@bentoml.service(resources={"cpu": "1"})
class Recomendador:

    def __init__(self) -> None:
        self.dados = Catalogo(modelo.path_of(ARTEFATO))

    @bentoml.api
    def recomendar(self, produto_id: str, limite: int = recomendador.LIMITE_PADRAO) -> dict:
        """RF  — peças afins à peça aberta na página de detalhes.

        Entrada:
          - produto_id: id da peça exibida (ex.: "p01")
          - limite: quantas sugestões (padrão 4, máximo 6)
        """
        origem = "POST /recomendar"
        try:
            produto = self.dados.buscar_peca(produto_id, origem)
        except ProdutoInexistente as exc:
            raise NotFound(f"produto_inexistente: {produto_id}") from exc
        resposta = self.dados.buscar_afins(produto, limite, origem)
        resposta["modelo"] = str(modelo.tag)
        return resposta

    @bentoml.api
    def catalogo(self) -> dict:
        """Lista o catálogo sintético carregado no modelo (para escolher ids de teste)."""
        return {"dados": self.dados.listar_pecas("POST /catalogo")}
