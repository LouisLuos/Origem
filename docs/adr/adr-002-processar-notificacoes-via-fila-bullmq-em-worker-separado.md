# ADR-002: Processar notificações via fila Redis/BullMQ em worker separado

- **Status:** Aceita
- **Data:** 2026-11-23
- **Autor:** LUIZ HENRIQUE SOUZA DA CONCEIÇÃO (lhsc@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O marketplace Origem precisa enviar notificações transacionais (e-mail e WhatsApp) para compradores e ateliês quando um pagamento é aprovado, o status de um pedido muda ou há risco no prazo de postagem (`HU-17`). Essas chamadas dependem de provedores externos sujeitos a lentidão, *rate limit* (`HTTP 429`) e quedas temporárias (`HTTP 500/503`), enquanto o fluxo HTTP da API precisa responder rápido e sem perder avisos (`RNF-03`, `RNF-05` e `RNF-12`).

## Preocupações

Tempo de resposta da API, bloqueio do *event loop*, tolerância a falhas de provedores externos, duplicidade de envios, custo operacional de infraestrutura

## Decisão

Desacoplar o disparo de notificações do servidor HTTP usando **fila persistente no Redis com BullMQ** e um **processo worker separado (`worker.ts`)**:

- **Produtor *fail-fast* e idempotente (`notification.queue.ts`):** registra o envio em `logs_notificacoes` com `idempotencyKey` antes de enfileirar e usa conexão Redis com timeout curto (`3000 ms`, `maxRetriesPerRequest: 2`) para não travar a API se o Redis cair.
- **Consumidor isolado com retentativas (`worker.ts`, `notification.processor.ts`):** executa renderização de templates e chamadas SMTP/WhatsApp fora do processo Express, com até `3` tentativas, *backoff* exponencial (`1000 ms` inicial), `removeOnFail: false` para reter falhas e distinção entre erros transitórios e permanentes (`UnrecoverableError`).

## Justificativa

Mover o envio para uma fila em processo separado impede que provedores lentos ou indisponíveis degradem o *event loop* e a latência do backend web. A persistência no Redis somada à chave de idempotência em `logs_notificacoes` garante que retentativas automáticas recuperem falhas temporárias sem enviar mensagens duplicadas ao comprador ou ao artesão. O custo de manter o Redis e o worker dedicado é compensado pela estabilidade do checkout e das rotas principais.

## Consequências

Ganhamos respostas HTTP rápidas, isolamento de falhas externas, retentativas automáticas com recuo exponencial e histórico rastreável de cada envio. Em contrapartida, assumimos maior complexidade operacional para executar e monitorar dois processos (`server` e `worker`) e a dependência do Redis em produção, além de precisar conectar o *relay* de *outbox* (`notificacaoOutbox.relay.ts`) na entrega completa do módulo de pedidos.

## Alternativas consideradas

- **Enviar e-mail e WhatsApp de forma síncrona na rota HTTP:** descartada porque acopla o tempo de resposta da API à latência e disponibilidade dos provedores externos.
- **Executar em segundo plano em memória no próprio Node (`setImmediate` / *promises* soltas):** descartada porque mensagens pendentes seriam perdidas em reinícios do servidor e o processamento disputaria CPU/*event loop* com a API.

## Rastreabilidade

**Atributo de qualidade:** Eficiência de Desempenho · Tempo de Resposta e Confiabilidade · Tolerância a Falhas (`RNF-03`, `RNF-05` e `RNF-12`)

**Cenário que originou a decisão:**

> Durante um pico de notificações em que o provedor externo responde com erro `HTTP 503` ou timeout, o backend enfileira o evento sem bloquear o *event loop* do Express, devolvendo a resposta HTTP dentro do esperado (`<= 800 ms` no P95), enquanto o worker separado executa até 3 retentativas com *backoff* exponencial e registra o estado final sem duplicar envios.

**Padrão arquitetural adotado:** Fila de Mensagens (Publish-Subscribe / Competing Consumers) com Worker Dedicado

**Táticas empacotadas:** Desacoplar processamento pesado via fila; Isolar falhas externas em processo separado; Falhar rápido no produtor (*Fail-Fast*); Retentar com *backoff* exponencial; Garantir idempotência por chave única

## Verificação

- **Regressão de *event loop* (`backend/tests/integracao/hu17-tc17-event-loop.test.ts`):** dispara rajadas sob falhas `HTTP 503` do provedor com o worker em processo separado e mede a latência do Express.
- **Integração BullMQ + PostgreSQL (`backend/tests/integracao/hu17-notificacoes-bullmq.test.ts`):** valida enfileiramento, consumo pelo worker, idempotência e gravação em `logs_notificacoes`.
- **Provedores e *outbox* (`backend/tests/hu17/providers.test.ts`, `notificacaoOutbox.relay.test.ts`):** valida classificação de falhas transitórias/permanentes (`429`/`500`/`503` vs `400`) e isolamento de falhas por item no *relay*.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
