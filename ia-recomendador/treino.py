"""Etapa offline: lê o catálogo sintético, calcula features/similaridade e grava no model store do BentoML."""

from __future__ import annotations

import json
from pathlib import Path

import bentoml

from recomendador import treinar

DADOS = Path(__file__).resolve().parent / "dados" / "catalogo.json"
NOME_MODELO = "origem-recomendador"
ARTEFATO = "artefato.json"


def main() -> None:
    catalogo = json.loads(DADOS.read_text(encoding="utf-8"))
    artefato = treinar(catalogo)

    with bentoml.models.create(
        NOME_MODELO,
        labels={"projeto": "origem", "hu": "HU-24"},
        metadata={
            "n_produtos": len(artefato["produtos"]),
            "n_cestas": len(catalogo.get("cestas", [])),
            "estrategia": artefato["estrategia"],
        },
    ) as modelo:
        Path(modelo.path_of(ARTEFATO)).write_text(
            json.dumps(artefato, ensure_ascii=False), encoding="utf-8"
        )
        tag = modelo.tag

    print(f"produtos no catalogo  {len(artefato['produtos'])}")
    print(f"modelo salvo          {tag}")


if __name__ == "__main__":
    main()
