# ADR-002: Adotar processamento orientado a eventos com fila Redis/BullMQ e worker separado para notificações

- **Status:** Aceita
- **Data:** 2026-11-23
- **Autor:** LUIZ HENRIQUE SOUZA DA CONCEICAO (lhsc@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O Origem é desenvolvido em um semestre por uma equipe pequena de estudantes, com stack acordada com Desenvolvimento Web (Express, TypeScript, Prisma) e modelo de dados acordado com Banco de Dados (PostgreSQL), sob restrição de hospedagem limitada sem orçamento de infraestrutura. Para atender às notificações transacionais de pedidos por e-mail e WhatsApp (HU-17) e aos acordos de arquitetura assíncrona com FCCPD, a aplicação precisa lidar com lentidão e indisponibilidade de provedores externos sem degradar o fluxo de compra.

## Preocupações

tolerância a falhas, tempo de resposta, idempotência, custo operacional, prazo

## Decisão

Desacoplar o envio de notificações da requisição HTTP publicando eventos em uma fila persistente no Redis com BullMQ (produtor fail-fast com chave de idempotência em logs_notificacoes) para consumo assíncrono em um processo worker separado. O worker executará as chamadas externas de e-mail e WhatsApp fora do servidor Express, com até 3 retentativas em recuo exponencial (1 s, 2 s e 4 s).

## Justificativa

Ao retirar as chamadas SMTP e WhatsApp da rota HTTP e adotar conexão Redis com timeout curto (3000 ms), a API mantém a resposta do pedido dentro do limite de 800 ms no percentil 95 mesmo durante falhas HTTP 503 ou lentidão do provedor externo. A persistência na fila BullMQ garante até 3 retentativas automáticas com backoff exponencial (1 s, 2 s e 4 s) sem perda em reinícios, enquanto a chave única de idempotência impede qualquer aviso duplicado ao comprador ou ao artesão.

## Consequências

Ganhamos isolamento de falhas externas, event loop livre na API, recuperação automática de instabilidades transitórias e histórico auditável de cada tentativa de envio. Em contrapartida, assumimos o custo operacional de manter o Redis e dois processos em execução (server e worker) dentro de hospedagem limitada, lidamos com consistência eventual na entrega dos avisos e mantemos pendente a integração final do relay de outbox (notificacaoOutbox.relay.ts) com o módulo completo de pedidos.

## Alternativas consideradas

Camadas síncronas (chamar provedores de e-mail e WhatsApp diretamente no serviço de pedido): descartada porque qualquer erro 503 ou timeout do provedor externo trava a resposta HTTP acima de 800 ms ou perde a notificação. Processamento em memória no próprio Node: descartado porque mensagens pendentes se perdem em reinícios do servidor e disputam recursos com a API. CQRS: descartado porque separa leitura e escrita com complexidade excessiva para o prazo e tamanho da equipe sem resolver a tolerância a falhas externas.

## Rastreabilidade

**Atributo de qualidade:** Confiabilidade · Tolerância a falhas

**Cenário que originou a decisão:**

> Durante um pico de pedidos em operação normal, o provedor externo de e-mail ou whatsapp retorna erro HTTP 503 ou timeout durante o disparo de avisos de um pedido no módulo de notificações e na fila assíncrona do backend. O sistema isola a falha fora da requisição do usuário, mantém a confirmação do pedido e reprocessa o envio em worker separado com chave de idempotência, respondendo à API em até 800 ms no percentil 95, realizando até 3 retentativas com recuo exponencial (1 s, 2 s e 4 s) e garantindo 0 notificações duplicadas.

**Padrão arquitetural adotado:** Orientado a Eventos

**Táticas empacotadas:** Processamento assíncrono; Usar intermediário (barramento ou fila)

História e RNFs: HU-17, RNF-03, RNF-05 e RNF-12. Módulos envolvidos: backend/src/queues/notification.queue.ts, backend/src/queues/notification.processor.ts, backend/src/worker.ts, backend/src/cache/redis.client.ts e backend/src/services/notificacaoOutbox.relay.ts.

## Verificação

- **Teste do cenário:** O cenário é exercitado por backend/tests/integracao/hu17-tc17-event-loop.test.ts (que dispara rajadas sob falhas HTTP 503 com o worker em processo separado e mede a latência do Express), complementado por backend/tests/integracao/hu17-notificacoes-bullmq.test.ts (integração BullMQ/Redis + PostgreSQL com idempotência e retentativas) e backend/tests/hu17/providers.test.ts (classificação de falhas transitórias 429/500/503 vs permanentes 400).

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
