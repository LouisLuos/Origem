# 🏺 Origem — Marketplace da Economia Criativa de Pernambuco

**Projeto Integrador IV · Análise e Desenvolvimento de Sistemas (2026.2)**
**CESAR School · Disciplinas Integradas do 4º Semestre**

---

## 📑 Sumário

- [Sobre o Projeto](#-sobre-o-projeto)
- [Checklist — Rubrica FCCPD](#-checklist--rubrica-fccpd-concorrência-mensageria-e-confiabilidade)
- [Como Executar](#️-como-executar)
- [Módulo de IA — Recomendador (AV1 prática)](#-módulo-de-ia--recomendador-av1-prática)
- [Estrutura da Documentação](#-estrutura-da-documentação-do-projeto)
- [Disciplinas Integradas](#-disciplinas-integradas)

---

## 📖 Sobre o Projeto

O **Origem** é uma aplicação web *full stack* criada para fortalecer a economia criativa e o artesanato tradicional do estado de Pernambuco.

Artesãos e mestres populares enfrentam, com frequência, três grandes desafios: **invisibilidade digital**, **dependência de intermediários comerciais** — que reduzem sua margem de renda — e **gestão precária** de catálogo, pedidos e estoque.

O **Origem** enfrenta esses problemas conectando essa produção autêntica diretamente a compradores de todo o país, valorizando três pilares:

- 📍 o **território de origem**;
- 🛠️ a **técnica tradicional** (cerâmica figurativa, renda renascença, xilogravura, marcenaria, entre outras);
- 👤 a **história de quem faz**.

---

## ✅ Checklist — Rubrica FCCPD (Concorrência, Mensageria e Confiabilidade)

A rubrica foi implementada de ponta a ponta em **Spring Boot + PostgreSQL real (Supabase)**, com evidências e um teste automatizado único cobrindo os 6 critérios avaliados:

| # | Critério | Evidência |
|---|---|---|
| 1 | **Implementation of Concurrency Control** | [`ProductRepository.findByIdForUpdate`](./src/main/java/com/origem/repository/ProductRepository.java) — `@Lock(PESSIMISTIC_WRITE)` / `SELECT ... FOR UPDATE`, usado em [`OrderService`](./src/main/java/com/origem/service/OrderService.java) |
| 2 | **Inventory Consistency Under Simultaneous Access** | Decremento de estoque dentro da transação com lock em [`OrderService.purchaseProduct`](./src/main/java/com/origem/service/OrderService.java); validado por 10 threads concorrentes no teste de confiabilidade |
| 3 | **Asynchronous Task Queue Setup** | [`AsyncConfig`](./src/main/java/com/origem/config/AsyncConfig.java) (`ThreadPoolTaskExecutor` dedicado) + fila persistida na tabela `notification` |
| 4 | **Decoupling and Message Integrity** | [`NotificationService.sendNotificationAsync`](./src/main/java/com/origem/service/NotificationService.java) — checkout responde antes do processamento; retries fixos (3x), sem perda de registro |
| 5 | **Evidence of System Reliability** | Teste único [`OrderReliabilityConcurrencyAndAsyncTest`](./src/test/java/com/origem/service/OrderReliabilityConcurrencyAndAsyncTest.java) + relatório em [`EVIDENCIAS.md`](./EVIDENCIAS.md) |
| 6 | **Statement of Artificial Intelligence Usage** | [`IA.md`](./IA.md) — declaração formal por requisito |

---

## ▶️ Como Executar

### Ambiente publicado

O frontend está publicado em **https://origem-five.vercel.app** e consome a Fake API disponível em **https://origem-bnhv.onrender.com/api/v1**.

> ⏳ A Render pode levar cerca de 1 minuto para responder à primeira requisição (cold start).

### Ambiente local (Node.js 18+)

**1. Fake API** — branch `fake-api`, pasta `fake_api/` — sobe em `http://localhost:3000/api/v1`:

```bash
git checkout fake-api
cd fake_api && npm install && node server.js
```

**2. Frontend** — branch `main`, pasta `frontend/` — sobe em `http://localhost:5173`:

```bash
cd frontend
npm install
npm run dev
```

**Usando a API publicada em vez da local:** crie o arquivo `frontend/.env.local` com:

```
VITE_API_URL=https://origem-bnhv.onrender.com/api/v1
```

Mais detalhes em [`frontend/README.md`](./frontend/README.md) e nos contratos da API em [`docs/05-desenvolvimento-web/contratos-api.md`](./docs/05-desenvolvimento-web/contratos-api.md).

---

## 🤖 Módulo de IA — Recomendador (AV1 prática)

Mockup executável do módulo de IA especificado na AV1 de **Engenharia de Software e IA**: a
**HU-24 · Recomendação Contextual de Peças Afins**. Quando o comprador abre a página de uma
peça, o módulo devolve outras peças da **mesma técnica ou do mesmo polo**, ranqueadas por
**similaridade de cosseno** (técnica, polo, categoria, faixa de preço) somada a um reforço de
**co-compra** (peças que costumam sair no mesmo pedido).

- **Squad:** Grupo 7 — Eduardo Henrique, Cauã dos Santos, Luiz Henrique, Matheus Freitas, Pedro Vinicius, Vinicius Gabriel e Marcos Antônio.
- **Trilha:** A — Recomendação / ranqueamento, servido com **BentoML**
  (base: [lgallindo/recomendador-bentoml](https://github.com/lgallindo/recomendador-bentoml)).
- **Código:** pasta [`ia-recomendador/`](./ia-recomendador/) — algoritmo e arquivos explicados em
  [`ia-recomendador/README.md`](./ia-recomendador/README.md).
- **Dados:** catálogo **sintético** com 14 peças e 10 compras em
  [`ia-recomendador/dados/catalogo.json`](./ia-recomendador/dados/catalogo.json). Não há dados reais.

### Instalar e subir

Pré-requisito: **Python 3.11+** (testado com 3.13). Os comandos funcionam no Linux, no macOS e no Windows.

```bash
git clone https://github.com/LouisLuos/Origem.git
cd Origem/ia-recomendador

python -m venv .venv
# Windows (PowerShell):  .venv\Scripts\Activate.ps1
# Linux / macOS:         source .venv/bin/activate

pip install -r requirements.txt

python treino.py                                   # offline: grava o modelo origem-recomendador no store do BentoML
bentoml serve service:Recomendador --port 3001     # online: deixe este terminal aberto
```

O serviço fica pronto quando o log mostrar `Service Recomendador initialized`. A documentação
interativa (Swagger) fica em **http://localhost:3001**.

> A porta 3001 evita conflito com a Fake API do Origem, que usa a 3000.

### Requisitos da AV1 → endpoints

| RF / critério da AV1 | Onde está especificado | Endpoint / artefato do mockup |
|---|---|---|
| **HU-24** — sugerir peças afins à peça aberta na página de detalhes | [Backlog, ordem 24](./docs/01-requisitos-e-arquitetura/00-backlog-priorizado-consolidado.md) | `POST /recomendar` com `{"produto_id": "p01", "limite": 4}` |
| **HU-24 · Cenário 1:** mesma técnica ou mesmo polo, até 6 peças, sem a própria peça, sem peças esgotadas | [BDD da HU-24](./docs/01-requisitos-e-arquitetura/03-historias-de-usuario-e-bdd.md) | Regras aplicadas em `POST /recomendar` (`limite` padrão 4, máximo 6) |
| **HU-24 · Cenário 2:** peças compradas juntas aparecem com prioridade | [BDD da HU-24](./docs/01-requisitos-e-arquitetura/03-historias-de-usuario-e-bdd.md) | Campo `coocorrencia` e motivo `comprados_juntos` no ranking de `POST /recomendar` |
| **T-IA-01** — extrair e vetorizar features (técnica, polo, categoria, preço) | [Tarefas SMART](./docs/01-requisitos-e-arquitetura/04-tarefas-smart.md) | `python treino.py` → modelo `origem-recomendador` no store do BentoML |
| **T-IA-02** — similaridade de cosseno e endpoint top-4 | [Tarefas SMART](./docs/01-requisitos-e-arquitetura/04-tarefas-smart.md) | `POST /recomendar` (campo `similaridade` por item) |
| Apoio — conhecer os ids do catálogo sintético | — | `POST /catalogo` (sem corpo) |
| **T-IA-03** — carrossel no frontend | [Tarefas SMART](./docs/01-requisitos-e-arquitetura/04-tarefas-smart.md) | Fora do escopo do mockup (Unidade 2) |

### Casos de teste

Com o serviço rodando, abra **outro terminal** e rode os comandos abaixo. Há uma versão para
bash (Linux, macOS ou Git Bash no Windows) e outra para PowerShell.

#### CT-01 — Cenário 1: mesma técnica ou polo, sem a própria peça e sem esgotados

A peça `p01` é uma cerâmica do Alto do Moura. A `p03` também é, mas está com estoque 0.

```bash
curl -s -X POST http://localhost:3001/recomendar -H "Content-Type: application/json" -d '{"produto_id": "p01"}'
```

```powershell
(Invoke-RestMethod -Method Post -Uri http://localhost:3001/recomendar -ContentType 'application/json' -Body '{"produto_id": "p01"}').items | Format-Table rank, product_id, tecnica, polo, motivos
```

**Resultado esperado:** HTTP 200 com exatamente 4 itens, nesta ordem:

| rank | product_id | tecnica | polo | motivos |
|---|---|---|---|---|
| 1 | p02 | ceramica | Alto do Moura | mesma_tecnica, mesmo_polo, comprados_juntos |
| 2 | p04 | ceramica | Tracunhaém | mesma_tecnica, comprados_juntos |
| 3 | p06 | couro | Alto do Moura | mesmo_polo, comprados_juntos |
| 4 | p05 | ceramica | Tracunhaém | mesma_tecnica |

`p01` (a própria peça) e `p03` (esgotada) **não** aparecem. Todos os itens são de cerâmica ou do Alto do Moura.

#### CT-02 — Cenário 2: peças compradas juntas ganham prioridade

A xilogravura `p07` é mais parecida em conteúdo com a `p09` (outro quadro, mesma faixa de preço),
mas nas compras sintéticas sai muito mais vezes junto com o cordel `p08`.

```bash
curl -s -X POST http://localhost:3001/recomendar -H "Content-Type: application/json" -d '{"produto_id": "p07"}'
```

```powershell
(Invoke-RestMethod -Method Post -Uri http://localhost:3001/recomendar -ContentType 'application/json' -Body '{"produto_id": "p07"}').items | Format-Table rank, product_id, similaridade, coocorrencia, score
```

**Resultado esperado:** HTTP 200 com 3 itens, nesta ordem:

| rank | product_id | similaridade | coocorrencia | score |
|---|---|---|---|---|
| 1 | p08 | 0.8677 | 1.0 | 0.9206 |
| 2 | p09 | 1.0 | 0.3333 | 0.7333 |
| 3 | p10 | 0.3386 | 0.3333 | 0.3365 |

`p08` fica em 1º lugar mesmo com similaridade menor que a da `p09`, por causa da co-compra (motivo `comprados_juntos`).

#### CT-03 — Produto inexistente

```bash
curl -s -i -X POST http://localhost:3001/recomendar -H "Content-Type: application/json" -d '{"produto_id": "nao-existe"}'
```

```powershell
try { Invoke-RestMethod -Method Post -Uri http://localhost:3001/recomendar -ContentType 'application/json' -Body '{"produto_id": "nao-existe"}' } catch { $_.Exception.Response.StatusCode.value__; $_.ErrorDetails.Message }
```

**Resultado esperado:** HTTP **404** com o corpo `[{"error":"produto_inexistente: nao-existe"}]`.

#### Testes automatizados (opcional)

Os mesmos cenários estão cobertos com pytest, sem precisar subir o servidor:

```bash
cd ia-recomendador
python -m pytest -q        # esperado: 6 passed
```

---

## 📁 Estrutura da Documentação do Projeto

A documentação completa de Engenharia de Software foi modularizada e organizada na pasta [`/docs`](./docs/README.md):

| Área | Conteúdo | Link |
|---|---|---|
| 🏛️ Requisitos e Arquitetura | Análise de domínio, modelagem conceitual UML, histórias BDD, tarefas SMART, priorização e princípios SOLID | [`docs/01-requisitos-e-arquitetura`](./docs/01-requisitos-e-arquitetura/) |
| 🗄️ Banco de Dados | Modelo ER, modelo lógico relacional, normalização 1FN–3FN, scripts DDL e seeds | [`docs/02-banco-de-dados`](./docs/02-banco-de-dados/) |
| ⚡ Computação Concorrente e Distribuída (FCCPD) | Controle de concorrência no checkout (lock pessimista no PostgreSQL), fila assíncrona baseada em banco e teste de consistência — implementação em [`/src`](./src), evidências em [`EVIDENCIAS.md`](./EVIDENCIAS.md) e [`IA.md`](./IA.md) | [`docs/03-computacao-concorrente-distribuida`](./docs/03-computacao-concorrente-distribuida/01-concorrencia-e-mensageria.md) |
| 🤖 Engenharia de Software e IA | Formulação do problema de recomendação, features do BD, baseline simples e métricas. Mockup executável em BentoML em [`/ia-recomendador`](./ia-recomendador/README.md) | [`docs/04-engenharia-software-e-ia`](./docs/04-engenharia-software-e-ia/) |
| 🌐 Desenvolvimento Web | Frontend responsivo, backend inicial, contratos da API e deploy. Código do front-end (vitrine + Design System) em [`/frontend`](./frontend/README.md) | [`docs/05-desenvolvimento-web`](./docs/05-desenvolvimento-web/) |
| 🎯 Projeto Integrador IV | Checkpoints quinzenais, matriz de riscos e acompanhamento da squad | [`docs/06-projeto-integrador-iv`](./docs/06-projeto-integrador-iv/) |

---

## 📚 Disciplinas Integradas

1. **Requisitos, Projeto de Software e Validação (ADS020)** — *Profª. Hayanna Silva Oliveira*
2. **Desenvolvimento Web**
3. **Modelagem e Projeto de Banco de Dados**
4. **Fundamentos de Computação Concorrente, Paralela e Distribuída (FCCPD)**
5. **Engenharia de Software e IA (Eletiva)**
6. **Projeto 4 (Acompanhamento e Integração)**