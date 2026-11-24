from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ProdutoPublico(BaseModel):
    id: str
    title: str
    artisan: str
    artisanId: str
    hub: str
    technique: str
    category: str | None = None
    price: float
    stock: int
    active: bool = True
    atelieId: str | None = None
    status: str | None = None
    imageUrl: str
    imageAlt: str
    description: str | None = None
    gallery: list[str] | None = None


class ArtesaoPublico(BaseModel):
    id: str
    name: str
    hub: str
    technique: str
    bio: str
    since: int | None = None
    photoUrl: str
    photoAlt: str
    coverUrl: str
    coverAlt: str
    pieces: list[ProdutoPublico] = Field(default_factory=list)


class PaginationMeta(BaseModel):
    totalItens: int
    paginaAtual: int
    totalPaginas: int
    itensPorPagina: int


class PaginatedProdutos(BaseModel):
    dados: list[ProdutoPublico]
    meta: PaginationMeta
    dataSource: str


class PaginatedArtesaos(BaseModel):
    dados: list[ArtesaoPublico]
    meta: PaginationMeta
    dataSource: str


class CestasResponse(BaseModel):
    cestas: list[list[str]]
    dataSource: str


class RecommendationItemPublico(ProdutoPublico):
    rank: int
    score: float
    similaridade: float
    coocorrencia: float
    motivos: list[str]


class RecommendationMetrics(BaseModel):
    mode: Literal["sequential", "parallel"]
    workers: int
    computeMs: float
    catalogFetchMs: float
    gatewayHttpMs: float
    totalMs: float
    catalogSize: int
    dataSource: str
    isSynthetic: bool = False


class ProductSummary(BaseModel):
    productId: str
    title: str
    technique: str
    hub: str


class RecommendationGatewayResponse(BaseModel):
    produtoNaPagina: ProductSummary
    items: list[RecommendationItemPublico]
    estrategia: str
    metrics: RecommendationMetrics


class HealthResponse(BaseModel):
    status: str
    service: str
    dataSource: str
    dbConnected: bool
    totalProducts: int
    totalArtisans: int
    recommendationServiceUrl: str
