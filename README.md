# 🏺 Origem — Marketplace da Economia Criativa de Pernambuco (FCCPD · Unidade 2)

> **Branch de entrega da FCCPD Unidade 2** — [`feat/fccpd-u2-fastapi`](https://github.com/LouisLuos/Origem/tree/feat/fccpd-u2-fastapi). A implementação substitui o backend Express/Prisma por arquitetura distribuída em **Python + FastAPI**, com comunicação HTTP/REST real entre serviços independentes, processamento paralelo com `ProcessPoolExecutor` nas recomendações (HU-24) e benchmark reproduzível.
>
> **Unidade 1.** A entrega em Spring Boot, com controle de estoque por lock pessimista e notificações assíncronas, está na branch `simulacao-fccpd`, commit `da3fdca`. [Código e evidências dessa revisão](https://github.com/LouisLuos/Origem/tree/da3fdca9e12f6f66b416cd86a61dcdc3938ef8cc).

---

## Integrantes

- Luiz Henrique Souza
- Cauã dos Santos
- Pedro Vinícius
- Marcos Tavares
- Matheus de Freitas
- Vinicius Gabriel dos Santos
- Eduardo Henrique Albuquerque

## 🧭 Arquitetura Implementada

- **Frontend (`frontend/`, porta `5173`):** Next.js 16 + React 19 + Tailwind CSS v4 com a identidade visual original do Origem preservada, focado nos fluxos públicos de vitrine, busca/filtros, perfil de artesãos, detalhes de produto e recomendações distribuídas com seletor **Sequencial vs Paralelo**.
- **Catalog Service (`services/catalog-service/`, porta `3001`):** API FastAPI responsável pelo catálogo de produtos, cestas e artesãos. Opera com leitura **somente-leitura (`BEGIN READ ONLY`)** do PostgreSQL/Supabase (quando configurado) combinada com [services/catalog-service/data/catalogo.json](./services/catalog-service/data/catalogo.json), ou de forma 100% independente com o JSON local. Orquestra chamadas HTTP (`httpx`) ao serviço de recomendações em `GET /api/v1/produtos/{id}/recomendacoes`.
- **Recommendation Service (`services/recommendation-service/`, porta `3002`):** API FastAPI independente que consome produtos e cestas do Catalog Service via **HTTP/REST (`httpx`)** e executa o algoritmo da HU-24 (similaridade de cosseno + co-ocorrência) em duas versões equivalentes: **sequencial** e **paralela (`ProcessPoolExecutor`)**.

Documentação completa, diagramas, metodologia, logs reais e análise de speedup/eficiência:  
📄 **[docs/fccpd-unidade-2/arquitetura-e-benchmark.md](./docs/fccpd-unidade-2/arquitetura-e-benchmark.md)**

---

## ▶️ Como Executar

### 1. Subir o Catalog Service (porta `3001`)
```powershell
cd services\catalog-service
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 3001
```

### 2. Subir o Recommendation Service (porta `3002`)
```powershell
cd services\recommendation-service
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 3002
```

### 3. Subir o Frontend (porta `5173`)
```powershell
cd frontend
npm run dev
```
Acesse **http://localhost:5173** e abra uma peça (ex.: `http://localhost:5173/produtos/p01`) para testar as recomendações distribuídas em tempo real.

---

## Laboratório de desempenho

Com os três serviços ativos, abra o [laboratório no frontend](http://localhost:5173/laboratorio-de-desempenho). Ele também está no cabeçalho e no rodapé.

1. Selecione **Acervo atual**, escolha **4 workers** e execute a comparação. Confira a origem e o número de peças que o serviço efetivamente leu.
2. Repita com **Sintético · 500 produtos**. Compare os tempos medianos do cálculo e do percurso completo. A escala dos dois gráficos é comum.
3. Expanda **Resultados equivalentes** para conferir os digests e as amostras. As medições são produzidas a cada clique. Para apresentar, use a interface local; para reproduzir a bateria experimental completa, use o script abaixo.

O acervo funciona em modo local ou híbrido com PostgreSQL somente leitura. Peças e perfis sem foto disponível usam ilustrações locais identificadas. [Metodologia e evidências do laboratório](docs/fccpd-unidade-2/arquitetura-e-benchmark.md#9-laboratório-interativo).

## 🧪 Testes e Benchmark Reproduzível

```powershell
# Testes unitários e de integração (cada microserviço em seu próprio processo)
.\.venv\Scripts\python.exe -m pytest services\catalog-service\tests -v
.\.venv\Scripts\python.exe -m pytest services\recommendation-service\tests -v

# Regressão da equivalência por amostra na CLI
.\.venv\Scripts\python.exe -m pytest benchmarks\test_benchmark_recommendations.py -q

# Benchmark completo (algorítmico + HTTP ponta a ponta com :3001 e :3002 ativos)
.\.venv\Scripts\python.exe benchmarks\benchmark_recommendations.py --with-http --repeats 5 --warmups 1
```

Resultados gerados em [`benchmarks/results/`](./benchmarks/results/):
- `benchmark_results.json` / `benchmark_results.csv` — métricas algorítmicas (`N=15` real e `N=200..2000` sintético determinístico).
- `http_e2e_results.json` — latências HTTP separadas (`catalog_fetch_ms`, `gateway_http_ms`, `compute_ms`).
- `http_communication.log` — logs reais da comunicação entre `:3001` e `:3002`.
