# 🏺 Origem — Marketplace da Economia Criativa de Pernambuco (FCCPD · Unidade 2)

> **Branch acadêmica isolada (`feat/fccpd-u2-fastapi`):** substituição completa do backend Express/Prisma por arquitetura distribuída em **Python + FastAPI**, com comunicação HTTP/REST real entre serviços independentes, processamento paralelo com `ProcessPoolExecutor` nas recomendações (HU-24) e benchmark reproduzível.
>
> **Unidade 1 (preservada):** As implementações anteriores de controle de concorrência no checkout/estoque (`SELECT ... FOR UPDATE`), fila assíncrona e testes da Unidade 1 permanecem intactas nas branches `main` e `simulacao-fccpd`, com evidências registradas em [EVIDENCIAS.md](./EVIDENCIAS.md) e [docs/03-computacao-concorrente-distribuida/01-concorrencia-e-mensageria.md](./docs/03-computacao-concorrente-distribuida/01-concorrencia-e-mensageria.md).

---

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

## 🧪 Testes e Benchmark Reproduzível

```powershell
# Testes unitários e de integração (cada microserviço em seu próprio processo)
.\.venv\Scripts\python.exe -m pytest services\catalog-service\tests -v
.\.venv\Scripts\python.exe -m pytest services\recommendation-service\tests -v

# Benchmark completo (algorítmico + HTTP ponta a ponta com :3001 e :3002 ativos)
.\.venv\Scripts\python.exe benchmarks\benchmark_recommendations.py --with-http --repeats 5 --warmups 1
```

Resultados gerados em [`benchmarks/results/`](./benchmarks/results/):
- `benchmark_results.json` / `benchmark_results.csv` — métricas algorítmicas (`N=15` real e `N=200..2000` sintético determinístico).
- `http_e2e_results.json` — latências HTTP separadas (`catalog_fetch_ms`, `gateway_http_ms`, `compute_ms`).
- `http_communication.log` — logs reais da comunicação entre `:3001` e `:3002`.
