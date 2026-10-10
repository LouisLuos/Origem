"""Lógica do recomendador da HU-24 (sem BentoML, para poder ser testada isolada).

T-IA-01: cada peça vira um vetor de features (técnica, polo, categoria, faixa de preço).
T-IA-02: similaridade de cosseno entre vetores + reforço por co-compra (cestas).
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

# Peso de cada grupo de features no vetor. Técnica pesa mais porque é o
# principal critério da HU-24; polo vem logo atrás (mesma região).
PESOS = {"tecnica": 1.0, "polo": 0.8, "categoria": 0.4, "faixa_preco": 0.3}

# Mistura final: conteúdo (cosseno) + comportamento (comprados juntos).
PESO_COSSENO = 0.6
PESO_COOC = 0.4

LIMITE_PADRAO = 4  # DoD da T-IA-02: top-4
LIMITE_MAXIMO = 6  # Cenário 1 da HU-24: "até 6 peças"


def faixa_preco(preco: float) -> str:
    if preco <= 100:
        return "ate_100"
    if preco <= 200:
        return "100_a_200"
    return "acima_200"


def vetorizar(produtos: list[dict]) -> tuple[list[str], np.ndarray]:
    """One-hot ponderado de cada peça. Devolve (ids, matriz n_produtos x n_features)."""
    features: list[tuple[str, str]] = []
    for grupo in PESOS:
        valores = sorted({_valor(p, grupo) for p in produtos})
        features.extend((grupo, v) for v in valores)
    indice = {f: i for i, f in enumerate(features)}

    matriz = np.zeros((len(produtos), len(features)))
    for linha, p in enumerate(produtos):
        for grupo, peso in PESOS.items():
            matriz[linha, indice[(grupo, _valor(p, grupo))]] = peso
    return [p["id"] for p in produtos], matriz


def similaridade_cosseno(matriz: np.ndarray) -> np.ndarray:
    normas = np.linalg.norm(matriz, axis=1, keepdims=True)
    unit = matriz / np.where(normas == 0, 1, normas)
    return unit @ unit.T


def coocorrencia(cestas: list[list[str]]) -> dict[str, dict[str, float]]:
    """Para cada peça A: quanto cada B saiu na mesma compra, normalizado em 0..1."""
    conta: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for cesta in cestas:
        ids = list(dict.fromkeys(cesta))
        for i, a in enumerate(ids):
            for b in ids[i + 1 :]:
                conta[a][b] += 1
                conta[b][a] += 1
    return {
        a: {b: n / max(viz.values()) for b, n in viz.items()} for a, viz in conta.items()
    }


def treinar(catalogo: dict) -> dict:
    """Gera o artefato que o serviço carrega (só tipos JSON-serializáveis)."""
    produtos = catalogo["produtos"]
    ids, matriz = vetorizar(produtos)
    sim = similaridade_cosseno(matriz)
    return {
        "produtos": {p["id"]: p for p in produtos},
        "ids": ids,
        "similaridade": np.round(sim, 6).tolist(),
        "cooc": coocorrencia(catalogo.get("cestas", [])),
        "estrategia": "cosseno_conteudo+coocorrencia",
    }


def recomendar(artefato: dict, produto_id: str, limite: int = LIMITE_PADRAO) -> dict:
    """Peças afins à peça aberta na página (HU-24).

    Regras do BDD: candidatas precisam ser da mesma técnica OU do mesmo polo,
    nunca a própria peça, nunca peça com estoque zerado; no máximo 6.
    """
    produtos = artefato["produtos"]
    if produto_id not in produtos:
        return {"erro": "produto_inexistente", "produto_id": produto_id, "items": []}

    limite = max(1, min(int(limite), LIMITE_MAXIMO))
    atual = produtos[produto_id]
    linha = artefato["similaridade"][artefato["ids"].index(produto_id)]
    cooc = artefato["cooc"].get(produto_id, {})

    candidatos = []
    for j, pid in enumerate(artefato["ids"]):
        p = produtos[pid]
        mesma_tecnica = p["tecnica"] == atual["tecnica"]
        mesmo_polo = p["polo"] == atual["polo"]
        if pid == produto_id or p["estoque"] <= 0 or not (mesma_tecnica or mesmo_polo):
            continue
        cos = linha[j]
        co = cooc.get(pid, 0.0)
        candidatos.append(
            {
                "product_id": pid,
                "nome": p["nome"],
                "artesao": p["artesao"],
                "tecnica": p["tecnica"],
                "polo": p["polo"],
                "preco": p["preco"],
                "score": round(PESO_COSSENO * cos + PESO_COOC * co, 4),
                "similaridade": round(cos, 4),
                "coocorrencia": round(co, 4),
                "motivos": _motivos(mesma_tecnica, mesmo_polo, co),
            }
        )

    # Desempate pelo id para a resposta ser sempre a mesma (testes reproduzíveis).
    candidatos.sort(key=lambda c: (-c["score"], c["product_id"]))
    items = [{**c, "rank": r} for r, c in enumerate(candidatos[:limite], start=1)]

    return {
        "produto_na_pagina": {
            "product_id": produto_id,
            "nome": atual["nome"],
            "tecnica": atual["tecnica"],
            "polo": atual["polo"],
        },
        "items": items,
        "estrategia": artefato["estrategia"],
    }


def _valor(produto: dict, grupo: str) -> str:
    if grupo == "faixa_preco":
        return faixa_preco(produto["preco"])
    return produto[grupo]


def _motivos(mesma_tecnica: bool, mesmo_polo: bool, cooc: float) -> list[str]:
    motivos = []
    if mesma_tecnica:
        motivos.append("mesma_tecnica")
    if mesmo_polo:
        motivos.append("mesmo_polo")
    if cooc > 0:
        motivos.append("comprados_juntos")
    return motivos
