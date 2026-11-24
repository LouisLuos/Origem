from __future__ import annotations

import random
from typing import Any


def expand_catalog_deterministically(
    base_produtos: list[dict[str, Any]],
    base_cestas: list[list[str]],
    target_size: int,
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[list[str]]]:
    """Gera catálogo sintético determinístico a partir das peças reais/base.

    Identificado explicitamente como dado sintético para benchmarks de escalabilidade.
    """
    if target_size <= len(base_produtos):
        return list(base_produtos[:target_size]), list(base_cestas)

    rng = random.Random(seed)
    expanded: list[dict[str, Any]] = [dict(p) for p in base_produtos]
    base_count = len(base_produtos)

    for idx in range(base_count, target_size):
        template = dict(base_produtos[idx % base_count])
        base_price = float(template.get("price") if "price" in template else template.get("preco", 120.0))
        varied_price = round(max(25.0, base_price * rng.uniform(0.75, 1.35)), 2)
        base_stock = int(template.get("stock") if "stock" in template else template.get("estoque", 5))
        stock_val = 0 if (idx % 17 == 0) else max(1, (base_stock + idx) % 15 + 1)

        title = str(template.get("title") or template.get("nome") or "Peça Artesanal")
        new_id = f"syn-{idx + 1:04d}"
        expanded.append(
            {
                "id": new_id,
                "title": f"{title} — Edição #{idx + 1}",
                "artisan": template.get("artisan") or template.get("artesao") or "Mestre Convidado",
                "technique": template.get("technique") or template.get("tecnica") or "Cerâmica Figurativa",
                "hub": template.get("hub") or template.get("polo") or "Alto do Moura",
                "category": template.get("category") or template.get("categoria") or "decoracao",
                "price": varied_price,
                "stock": stock_val,
            }
        )

    all_ids = [str(p["id"]) for p in expanded]
    synthetic_cestas = [list(c) for c in base_cestas]
    num_extra_baskets = max(10, target_size // 3)
    for _ in range(num_extra_baskets):
        basket_len = rng.choice([2, 2, 3, 4])
        synthetic_cestas.append(rng.sample(all_ids, k=min(basket_len, len(all_ids))))

    return expanded, synthetic_cestas
