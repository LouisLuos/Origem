from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(SERVICE_DIR / ".env")

CPU_COUNT = os.cpu_count() or 2
PORT = int(os.getenv("PORT", "3002"))
CATALOG_SERVICE_URL = os.getenv(
    "CATALOG_SERVICE_URL", "http://localhost:3001"
).rstrip("/")
DEFAULT_WORKERS = max(1, min(int(os.getenv("DEFAULT_WORKERS", "4")), CPU_COUNT))
MAX_WORKERS = max(1, min(int(os.getenv("MAX_WORKERS", "8")), CPU_COUNT))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://localhost:3001",
    ).split(",")
    if origin.strip()
]
