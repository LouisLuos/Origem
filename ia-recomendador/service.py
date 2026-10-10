"""Etapa online: serviço BentoML do módulo de recomendação do Origem (HU-24)."""

from __future__ import annotations

import json
from pathlib import Path

import bentoml
from bentoml.exceptions import NotFound

import recomendador

modelo = bentoml.models.get("origem-recomendador:latest")
ARTEFATO = "artefato.json"


@bentoml.service(resources={"cpu": "1"})
class Recomendador:

    def __init__(self) -> None:
        caminho = Path(modelo.path_of(ARTEFATO))
        self.artefato = json.loads(caminho.read_text(encoding="utf-8"))

    @bentoml.api
    def recomendar(self, produto_id: str, limite: int = recomendador.LIMITE_PADRAO) -> dict:
        """RF HU-24 — peças afins à peça aberta na página de detalhes.

        Entrada:
          - produto_id: id da peça exibida (ex.: "p01")
          - limite: quantas sugestões (padrão 4, máximo 6)
        """
        resposta = recomendador.recomendar(self.artefato, produto_id, limite)
        if "erro" in resposta:
            raise NotFound(f"produto_inexistente: {produto_id}")
        resposta["modelo"] = str(modelo.tag)
        return resposta

    @bentoml.api
    def catalogo(self) -> dict:
        """Lista o catálogo sintético carregado no modelo (para escolher ids de teste)."""
        return {"dados": list(self.artefato["produtos"].values())}
