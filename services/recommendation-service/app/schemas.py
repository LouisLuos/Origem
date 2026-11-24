from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    product_id: str = Field(..., min_length=1)
    limit: int = Field(default=4, ge=1, le=6)
    mode: Literal["sequential", "parallel"] = "parallel"
    workers: int | None = Field(default=None, ge=1, le=16)
    synthetic_size: int | None = Field(default=None, ge=20, le=5000)


class BatchRecommendationRequest(BaseModel):
    limit: int = Field(default=4, ge=1, le=6)
    mode: Literal["sequential", "parallel"] = "parallel"
    workers: int | None = Field(default=None, ge=1, le=16)
    synthetic_size: int | None = Field(default=None, ge=20, le=5000)
    batch_size: int | None = Field(default=None, ge=1, le=5000)


class RecommendationItem(BaseModel):
    rank: int
    product_id: str
    nome: str
    artesao: str
    tecnica: str
    polo: str
    preco: float
    score: float
    similaridade: float
    coocorrencia: float
    motivos: list[str]


class ProductOnPage(BaseModel):
    product_id: str
    nome: str
    tecnica: str
    polo: str


class ServiceMetrics(BaseModel):
    mode: Literal["sequential", "parallel"]
    workers: int
    compute_ms: float
    catalog_fetch_ms: float
    total_ms: float
    catalog_size: int
    processed_targets: int = 1
    data_source: str
    is_synthetic: bool = False


class RecommendationResponse(BaseModel):
    produto_na_pagina: ProductOnPage
    items: list[RecommendationItem]
    estrategia: str
    metrics: ServiceMetrics


class BatchRecommendationResponse(BaseModel):
    estrategia: str
    sample_results: dict[str, list[RecommendationItem]]
    result_digest: str
    metrics: ServiceMetrics


class HealthResponse(BaseModel):
    status: str
    service: str
    cpuCount: int
    defaultWorkers: int
    maxWorkers: int
    catalogServiceUrl: str
    poolActive: bool
    raw: dict[str, Any] = Field(default_factory=dict)
