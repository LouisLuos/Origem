"""Motor de recomendação da HU-24 adaptado para comparação Sequencial vs Paralela.

Reaproveita fielmente a lógica de `ia-recomendador/recomendador.py`:
- Features ponderadas: técnica (1.0), polo (0.8), categoria (0.4), faixa_preco (0.3)
- Similaridade de cosseno + reforço por co-ocorrência em cestas (0.6 / 0.4)
- Regras BDD: mesma técnica OU mesmo polo, exclui a própria peça, exclui estoque <= 0
- Ordenação determinística por (-score, product_id)

A mesma função matemática (`_score_candidates_chunk` / `_recommend_for_target`)
é executada no modo sequencial (1 processo) e no modo paralelo (`ProcessPoolExecutor`).
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from concurrent.futures import Executor
from typing import Any

PESOS: dict[str, float] = {
    "tecnica": 1.0,
    "polo": 0.8,
    "categoria": 0.4,
    "faixa_preco": 0.3,
}
PESO_COSSENO = 0.6
PESO_COOC = 0.4
LIMITE_PADRAO = 4
LIMITE_MAXIMO = 6
ESTRATEGIA = "cosseno_conteudo+coocorrencia"


def faixa_preco(preco: float) -> str:
    if preco <= 100:
        return "ate_100"
    if preco <= 200:
        return "100_a_200"
    return "acima_200"


def normalize_product(raw: dict[str, Any]) -> dict[str, Any]:
    """Normaliza chaves vindas do Catalog Service (EN) ou catálogo legado (PT)."""
    pid = str(raw["id"])
    nome = str(raw.get("title") or raw.get("nome") or "")
    artesao = str(raw.get("artisan") or raw.get("artesao") or "").strip()
    tecnica = str(raw.get("technique") or raw.get("tecnica") or "").strip()
    polo = str(raw.get("hub") or raw.get("polo") or "").strip()
    categoria = str(raw.get("category") or raw.get("categoria") or "geral").strip()
    preco = float(raw.get("price") if "price" in raw else raw.get("preco", 0.0))
    estoque = int(raw.get("stock") if "stock" in raw else raw.get("estoque", 0))
    return {
        "id": pid,
        "nome": nome,
        "artesao": artesao,
        "tecnica": tecnica,
        "polo": polo,
        "categoria": categoria,
        "preco": preco,
        "estoque": estoque,
    }


def _feature_value(produto: dict[str, Any], grupo: str) -> str:
    if grupo == "faixa_preco":
        return faixa_preco(produto["preco"])
    return str(produto[grupo])


def coocorrencia(cestas: list[list[str]]) -> dict[str, dict[str, float]]:
    """Para cada peça A: quanto cada B saiu na mesma compra, normalizado em 0..1."""
    conta: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for cesta in cestas:
        ids = list(dict.fromkeys(str(x) for x in cesta))
        for i, a in enumerate(ids):
            for b in ids[i + 1 :]:
                conta[a][b] += 1.0
                conta[b][a] += 1.0
    return {
        a: {b: n / max(viz.values()) for b, n in viz.items()}
        for a, viz in conta.items()
    }


def build_unit_vectors(
    produtos_norm: list[dict[str, Any]],
) -> dict[str, list[float]]:
    """Constrói vetores one-hot ponderados normalizados pela norma L2."""
    features: list[tuple[str, str]] = []
    for grupo in PESOS:
        valores = sorted({_feature_value(p, grupo) for p in produtos_norm})
        features.extend((grupo, v) for v in valores)
    indice = {f: i for i, f in enumerate(features)}
    n_features = len(features)

    unit_vectors: dict[str, list[float]] = {}
    for p in produtos_norm:
        vec = [0.0] * n_features
        for grupo, peso in PESOS.items():
            vec[indice[(grupo, _feature_value(p, grupo))]] = peso
        norma = math.sqrt(sum(v * v for v in vec))
        if norma > 0.0:
            vec = [v / norma for v in vec]
        unit_vectors[p["id"]] = vec
    return unit_vectors


def _cosine_unit(vec_a: list[float], vec_b: list[float]) -> float:
    return sum(a * b for a, b in zip(vec_a, vec_b))


def _motivos(mesma_tecnica: bool, mesmo_polo: bool, cooc: float) -> list[str]:
    motivos: list[str] = []
    if mesma_tecnica:
        motivos.append("mesma_tecnica")
    if mesmo_polo:
        motivos.append("mesmo_polo")
    if cooc > 0:
        motivos.append("comprados_juntos")
    return motivos


def _score_candidates_chunk(args: tuple[Any, ...]) -> list[dict[str, Any]]:
    """Função top-level picklável (Windows spawn) para avaliar um chunk de candidatos."""
    target, target_vec, candidates_chunk, unit_vectors_chunk, cooc_target = args
    target_id = target["id"]
    candidatos: list[dict[str, Any]] = []

    for p, vec_p in zip(candidates_chunk, unit_vectors_chunk):
        pid = p["id"]
        mesma_tecnica = p["tecnica"] == target["tecnica"]
        mesmo_polo = p["polo"] == target["polo"]
        if pid == target_id or p["estoque"] <= 0 or not (mesma_tecnica or mesmo_polo):
            continue

        cos = _cosine_unit(target_vec, vec_p)
        co = cooc_target.get(pid, 0.0)
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
    return candidatos


def _recommend_for_target(
    target_id: str,
    by_id: dict[str, dict[str, Any]],
    ordered_produtos: list[dict[str, Any]],
    unit_vectors: dict[str, list[float]],
    cooc_map: dict[str, dict[str, float]],
    limite: int,
) -> list[dict[str, Any]]:
    target = by_id[target_id]
    target_vec = unit_vectors[target_id]
    cooc_target = cooc_map.get(target_id, {})
    vec_list = [unit_vectors[p["id"]] for p in ordered_produtos]
    candidatos = _score_candidates_chunk(
        (target, target_vec, ordered_produtos, vec_list, cooc_target)
    )
    candidatos.sort(key=lambda c: (-c["score"], c["product_id"]))
    return [{**c, "rank": r} for r, c in enumerate(candidatos[:limite], start=1)]


def _recommend_batch_chunk(args: tuple[Any, ...]) -> list[tuple[str, list[dict[str, Any]]]]:
    """Função top-level picklável (Windows spawn) para processar um lote de alvos."""
    target_ids_chunk, by_id, ordered_produtos, unit_vectors, cooc_map, limite = args
    results: list[tuple[str, list[dict[str, Any]]]] = []
    for tid in target_ids_chunk:
        items = _recommend_for_target(
            target_id=tid,
            by_id=by_id,
            ordered_produtos=ordered_produtos,
            unit_vectors=unit_vectors,
            cooc_map=cooc_map,
            limite=limite,
        )
        results.append((tid, items))
    return results


def _split_chunks(seq: list[Any], num_chunks: int) -> list[list[Any]]:
    if not seq:
        return []
    k = max(1, min(num_chunks, len(seq)))
    size, rem = divmod(len(seq), k)
    chunks: list[list[Any]] = []
    idx = 0
    for i in range(k):
        step = size + (1 if i < rem else 0)
        chunks.append(seq[idx : idx + step])
        idx += step
    return chunks


def recommend_single_sequential(
    produtos_raw: list[dict[str, Any]],
    cestas: list[list[str]],
    produto_id: str,
    limite: int = LIMITE_PADRAO,
) -> dict[str, Any]:
    produtos_norm = [normalize_product(p) for p in produtos_raw]
    by_id = {p["id"]: p for p in produtos_norm}
    if produto_id not in by_id:
        return {"erro": "produto_inexistente", "produto_id": produto_id, "items": []}

    safe_limit = max(1, min(int(limite), LIMITE_MAXIMO))
    unit_vectors = build_unit_vectors(produtos_norm)
    cooc_map = coocorrencia(cestas)
    items = _recommend_for_target(
        target_id=produto_id,
        by_id=by_id,
        ordered_produtos=produtos_norm,
        unit_vectors=unit_vectors,
        cooc_map=cooc_map,
        limite=safe_limit,
    )
    atual = by_id[produto_id]
    return {
        "produto_na_pagina": {
            "product_id": produto_id,
            "nome": atual["nome"],
            "tecnica": atual["tecnica"],
            "polo": atual["polo"],
        },
        "items": items,
        "estrategia": ESTRATEGIA,
    }


def recommend_single_parallel(
    produtos_raw: list[dict[str, Any]],
    cestas: list[list[str]],
    produto_id: str,
    executor: Executor,
    workers: int,
    limite: int = LIMITE_PADRAO,
) -> dict[str, Any]:
    produtos_norm = [normalize_product(p) for p in produtos_raw]
    by_id = {p["id"]: p for p in produtos_norm}
    if produto_id not in by_id:
        return {"erro": "produto_inexistente", "produto_id": produto_id, "items": []}

    safe_limit = max(1, min(int(limite), LIMITE_MAXIMO))
    unit_vectors = build_unit_vectors(produtos_norm)
    cooc_map = coocorrencia(cestas)

    atual = by_id[produto_id]
    target_vec = unit_vectors[produto_id]
    cooc_target = cooc_map.get(produto_id, {})

    product_chunks = _split_chunks(produtos_norm, workers)
    tasks = [
        (
            atual,
            target_vec,
            chunk,
            [unit_vectors[p["id"]] for p in chunk],
            cooc_target,
        )
        for chunk in product_chunks
    ]

    candidatos: list[dict[str, Any]] = []
    for partial in executor.map(_score_candidates_chunk, tasks):
        candidatos.extend(partial)

    candidatos.sort(key=lambda c: (-c["score"], c["product_id"]))
    items = [{**c, "rank": r} for r, c in enumerate(candidatos[:safe_limit], start=1)]

    return {
        "produto_na_pagina": {
            "product_id": produto_id,
            "nome": atual["nome"],
            "tecnica": atual["tecnica"],
            "polo": atual["polo"],
        },
        "items": items,
        "estrategia": ESTRATEGIA,
    }


def recommend_batch_sequential(
    produtos_raw: list[dict[str, Any]],
    cestas: list[list[str]],
    target_ids: list[str] | None = None,
    limite: int = LIMITE_PADRAO,
) -> dict[str, list[dict[str, Any]]]:
    produtos_norm = [normalize_product(p) for p in produtos_raw]
    by_id = {p["id"]: p for p in produtos_norm}
    safe_limit = max(1, min(int(limite), LIMITE_MAXIMO))
    unit_vectors = build_unit_vectors(produtos_norm)
    cooc_map = coocorrencia(cestas)

    targets = [tid for tid in (target_ids or [p["id"] for p in produtos_norm]) if tid in by_id]
    return {
        tid: _recommend_for_target(
            target_id=tid,
            by_id=by_id,
            ordered_produtos=produtos_norm,
            unit_vectors=unit_vectors,
            cooc_map=cooc_map,
            limite=safe_limit,
        )
        for tid in targets
    }


def recommend_batch_parallel(
    produtos_raw: list[dict[str, Any]],
    cestas: list[list[str]],
    executor: Executor,
    workers: int,
    target_ids: list[str] | None = None,
    limite: int = LIMITE_PADRAO,
) -> dict[str, list[dict[str, Any]]]:
    produtos_norm = [normalize_product(p) for p in produtos_raw]
    by_id = {p["id"]: p for p in produtos_norm}
    safe_limit = max(1, min(int(limite), LIMITE_MAXIMO))
    unit_vectors = build_unit_vectors(produtos_norm)
    cooc_map = coocorrencia(cestas)

    targets = [tid for tid in (target_ids or [p["id"] for p in produtos_norm]) if tid in by_id]
    target_chunks = _split_chunks(targets, workers)
    tasks = [
        (chunk, by_id, produtos_norm, unit_vectors, cooc_map, safe_limit)
        for chunk in target_chunks
    ]

    output: dict[str, list[dict[str, Any]]] = {}
    for partial in executor.map(_recommend_batch_chunk, tasks):
        for tid, items in partial:
            output[tid] = items
    return output


def compute_batch_digest(batch_results: dict[str, list[dict[str, Any]]]) -> str:
    """Hash SHA-256 determinístico para comprovar equivalência exata sequencial == paralelo."""
    canonical = json.dumps(batch_results, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
