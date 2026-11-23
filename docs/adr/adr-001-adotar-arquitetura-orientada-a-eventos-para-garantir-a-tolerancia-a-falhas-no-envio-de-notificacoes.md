# ADR-001: Adotar arquitetura orientada a eventos para garantir a tolerância a falhas no envio de notificações.

- **Status:** Aceita
- **Data:** 2026-11-23
- **Autor:** CAUA DOS SANTOS NASCIMENTO (csn@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O ORIGEM é um marketplace de artesanato desenvolvido por uma equipe pequena de estudantes, com prazo de um semestre e outras disciplinas acontecendo em paralelo. A stack de desenvolvimento já foi definida em conjunto com a disciplina de Desenvolvimento Web, enquanto a modelagem do banco de dados foi acordada com a equipe de Banco de Dados que também foi imposto pela disciplina. O projeto também possui limitações de hospedagem e orçamento. Nossa prioridade é garantir o funcionamento das funcionalidades principais, como cadastro de peças, vitrine, carrinho e checkout, evitando que falhas em serviços externos, como o envio de e-mails, prejudiquem a finalização das compras.

## Preocupações

Tolerância a falhas, confiabilidade, desempenho, testabilidade, disponibilidade, custo de infraestrutura, complexidade de manutenção, prazo de entrega.

## Decisão

Adotar o padrão Orientado a Eventos no fluxo de notificações do ORIGEM, utilizando Outbox Transacional no PostgreSQL, BullMQ/Redis e um worker separado da API Express. Dessa forma, o envio de e-mails será processado de maneira assíncrona, com até 3 tentativas em caso de falhas temporárias, sem interromper a finalização da compra.

## Justificativa

Essa decisão atende ao cenário de tolerância a falhas porque separa o envio de notificações do fluxo principal de pagamento. Quando o provedor de e-mails retorna um erro HTTP 503, o worker realiza até 3 tentativas de envio, com intervalos de 1 e 2 segundos, sem bloquear a resposta da API. Além disso, o uso da Outbox Transacional permite preservar o evento no PostgreSQL antes do enfileiramento no BullMQ/Redis. Nos testes realizados com um provedor simulado, a API respondeu a 120 requisições ao endpoint de saúde sem erros, com latência P95 de 5,38 ms, demonstrando que as falhas no envio de notificações não comprometeram a responsividade desse endpoint.

## Consequências

Ganhos: Maior tolerância a falhas, checkout sem bloqueios pelo serviço de e-mail e retentativas automáticas de envio.

Perdas: Maior complexidade de manutenção, dependência do Redis e do worker, consistência eventual e necessidade de tratar notificações que falham após as 3 tentativas.

## Alternativas consideradas

Portas e Adaptadores: descartado como padrão principal porque, apesar de isolar os provedores externos, não garante sozinho o processamento assíncrono nem impede que falhas no envio de e-mails afetem o checkout.

Camadas: descartado como solução principal porque organiza as responsabilidades do sistema, mas não oferece, por si só, mecanismos de tolerância a falhas externas.

## Rastreabilidade

**Atributo de qualidade:** Confiabilidade · Tolerância a falhas

**Cenário que originou a decisão:**

> Durante a finalização de uma compra no ORIGEM, em um cenário de operação degradada, o provedor externo de e-mails fica temporariamente indisponível e retorna um erro HTTP 503 ao tentar enviar uma notificação. Diante disso, o módulo de notificações transacionais, que utiliza Redis, BullMQ e um worker separado da API Express, deve manter a notificação na fila e realizar até 3 tentativas de envio, com backoff exponencial de 1 e 2 segundos entre elas, sem interromper ou prejudicar a finalização da compra. Durante essa falha, a API deve permanecer responsiva, com latência P95 inferior a 300 ms e sem erros nas requisições causados pela indisponibilidade do provedor.

**Padrão arquitetural adotado:** Orientado a Eventos

**Táticas empacotadas:** Processamento assíncrono; Usar intermediário (barramento ou fila); Degradação graciosa do consumidor

HU-10 (Checkout e Pagamentos), HU-17 (Notificações), TC17 (Teste de tolerância a falhas), backend/src/worker.ts, backend/src/services/notificacaoOutbox.relay.ts, backend/src/queues/notification.queue.ts e backend/src/queues/notification.processor.ts.

## Verificação

- **Teste do cenário:** TC17 (hu17-tc17-event-loop.test.ts): simula 45 falhas HTTP 503 no provedor de e-mails enquanto realiza 120 requisições à API. O teste verifica que nenhuma requisição falhe e que a latência P95 permaneça abaixo de 300 ms. O teste hu17-notificacoes-bullmq.test.ts valida as 3 tentativas de envio, com intervalos de 1 e 2 segundos.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
