# 🏺 Origem — Marketplace da Economia Criativa de Pernambuco

**Projeto Integrador IV · Análise e Desenvolvimento de Sistemas (2026.2)**
**CESAR School · Disciplinas Integradas do 4º Semestre**

---

## 📑 Sumário

- [Sobre o Projeto](#-sobre-o-projeto)
- [Checklist — Rubrica FCCPD](#-checklist--rubrica-fccpd-concorrência-mensageria-e-confiabilidade)
- [Como Executar](#️-como-executar)
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

## 📁 Estrutura da Documentação do Projeto

A documentação completa de Engenharia de Software foi modularizada e organizada na pasta [`/docs`](./docs/README.md):

| Área | Conteúdo | Link |
|---|---|---|
| 🏛️ Requisitos e Arquitetura | Análise de domínio, modelagem conceitual UML, histórias BDD, tarefas SMART, priorização e princípios SOLID | [`docs/01-requisitos-e-arquitetura`](./docs/01-requisitos-e-arquitetura/) |
| 🗄️ Banco de Dados | Modelo ER, modelo lógico relacional, normalização 1FN–3FN, scripts DDL e seeds | [`docs/02-banco-de-dados`](./docs/02-banco-de-dados/) |
| ⚡ Computação Concorrente e Distribuída (FCCPD) | Controle de concorrência no checkout (lock pessimista no PostgreSQL), fila assíncrona baseada em banco e teste de consistência — implementação em [`/src`](./src), evidências em [`EVIDENCIAS.md`](./EVIDENCIAS.md) e [`IA.md`](./IA.md) | [`docs/03-computacao-concorrente-distribuida`](./docs/03-computacao-concorrente-distribuida/01-concorrencia-e-mensageria.md) |
| 🤖 Engenharia de Software e IA | Formulação do problema de recomendação, features do BD, baseline simples e métricas | [`docs/04-engenharia-software-e-ia`](./docs/04-engenharia-software-e-ia/) |
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