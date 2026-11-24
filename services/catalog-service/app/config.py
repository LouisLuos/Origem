from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from dotenv import load_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = SERVICE_DIR / "data" / "catalogo.json"

load_dotenv(SERVICE_DIR / ".env")


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "sim", "on"}


def sanitize_postgres_dsn(raw_dsn: str) -> str:
    """Remove parâmetros específicos de Prisma/PgBouncer incompatíveis com libpq/psycopg."""
    cleaned = raw_dsn.strip().strip('"').strip("'")
    if not cleaned:
        return ""
    parsed = urlparse(cleaned)
    filtered_query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in {"pgbouncer", "connection_limit", "pool_timeout"}
    ]
    return urlunparse(parsed._replace(query=urlencode(filtered_query)))


PORT = int(os.getenv("PORT", "3001"))
USE_POSTGRES = _parse_bool(
    os.getenv("USE_POSTGRES", os.getenv("CATALOG_USE_DB")),
    default=True,
)
DIRECT_URL = sanitize_postgres_dsn(os.getenv("DIRECT_URL", ""))
DATABASE_URL = sanitize_postgres_dsn(os.getenv("DATABASE_URL", ""))
POSTGRES_DSN = DIRECT_URL or DATABASE_URL
RECOMMENDATION_SERVICE_URL = os.getenv(
    "RECOMMENDATION_SERVICE_URL", "http://localhost:3002"
).rstrip("/")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    if origin.strip()
]
