from __future__ import annotations

import re
import unicodedata

TECHNIQUE_MAP: dict[str, str] = {
    "ceramica": "Cerâmica Figurativa",
    "couro": "Couro",
    "xilogravura": "Xilogravura",
    "papel_mache": "Papel Machê",
    "renda_renascenca": "Renda Renascença",
    "bordado": "Bordado",
}


def format_technique(raw_technique: str) -> str:
    """Normaliza o identificador da técnica para o padrão do Design System."""
    return TECHNIQUE_MAP.get(raw_technique, raw_technique)


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    without_accents = "".join(
        ch for ch in normalized if unicodedata.category(ch) != "Mn"
    )
    lowered = without_accents.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug


def build_artisan_id(name: str) -> str:
    """Gera identificador estável 'art-<slug>' igual ao contrato original."""
    return f"art-{slugify(name.strip())}"
