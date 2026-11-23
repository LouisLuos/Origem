# ADR-005: Adotar bloqueio pessimista no banco de dados para reserva concorrente de peças

- **Status:** Aceita
- **Data:** 2026-11-23
- **Autor:** MARCOS ANTONIO TAVEIRA FRAGA (matf@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O Origem é desenvolvido por uma equipe de estudantes em um único semestre, integrando Desenvolvimento Web, Banco de Dados e Requisitos. A stack acordada utiliza Node.js com Express e TypeScript no backend, Next.js no frontend e PostgreSQL no Supabase. O catálogo comercializa artesanato pernambucano, onde grande parte dos itens são peças únicas com estoque unitário, e o projeto possui hospedagem limitada sem orçamento para infraestrutura distribuída complexa.

## Preocupações

integridade de dados, concorrência, prazo de entrega, simplicidade de infraestrutura, experiência do comprador

## Decisão

Centralizar a validação e a reserva atômica de estoque no servidor através de transações ACID no PostgreSQL com bloqueio pessimista (SELECT ... FOR UPDATE) na tabela de peças. Uma reserva concede exclusividade temporária de 15 minutos para a compra, retornando erro de conflito (HTTP 409) para qualquer requisição concorrente caso o saldo seja zero.

## Justificativa

Ao centralizar a regra no servidor e delegar o bloqueio atômico de linha ao PostgreSQL, garantimos que apenas a primeira transação a obter o lock consiga decrementar o estoque e criar a reserva de 15 minutos. As outras 49 requisições simultâneas aguardam a liberação da linha e, ao lerem o estoque zerado, são imediatamente recusadas com HTTP 409, eliminando qualquer risco de overselling sem exigir infraestrutura extra.

## Consequências

Ganha-se garantia absoluta de integridade do estoque (zero overselling) e simplicidade arquitetural usando os recursos nativos do PostgreSQL, sem custo de ferramentas adicionais. Em contrapartida, perde-se em escalabilidade horizontal massiva, pois requisições concorrentes pela mesma peça são serializadas no banco de dados, aumentando temporariamente o tempo de resposta e gerando contenção na linha bloqueada durante picos de disputa.

## Alternativas consideradas

Bloqueio otimista com controle de versão: descartado porque sob alta concorrência em uma única peça, dezenas de transações falhariam no momento do commit por conflito de versão, gerando retentativas repetidas e sobrecarga desnecessária.
Arquitetura orientada a eventos com fila assíncrona (RabbitMQ/Redis): descartada porque introduz consistência eventual, criando uma brecha de tempo onde dois compradores poderiam receber confirmação provisória antes do processamento da baixa, gerando venda duplicada, além de adicionar complexidade de infraestrutura desnecessária para o prazo do projeto.

## Rastreabilidade

**Atributo de qualidade:** Segurança (security) · Integridade

**Cenário que originou a decisão:**

> Em ambiente de produção sob pico de tráfego durante divulgação cultural da Fenearte, cinquenta compradores simultâneos submetem requisições de checkout tentando reservar a última unidade disponível de uma peça única de artesanato no serviço de reserva de estoque e na tabela de peças do banco de dados. O sistema serializa as transações atomicamente, concedendo a reserva temporária de 15 minutos para apenas uma requisição com HTTP 201 e recusando as outras 49 com HTTP 409, garantindo 0% de overselling, saldo final de estoque consistente em zero e ausência de deadlocks.

**Padrão arquitetural adotado:** Cliente-servidor

**Táticas empacotadas:** Centralizar regra e dado no servidor

HU-06 (Gestão de Lotes Limitados e Controle de Estoque), HU-09 (Carrinho Fracionado e Reserva Concorrente), Invariante 1 do Domínio, TC-STRESS-01.

## Verificação

- **Teste do cenário:** O teste automatizado de integração real backend/tests/integracao/hu06-estoque-concorrencia.test.ts (caso TC-STRESS-01), que dispara 50 requisições HTTP simultâneas disputando 1 única unidade de peça artesanal contra o PostgreSQL no Supabase, verificando exatamente 1 retorno HTTP 201 com reserva de 15 minutos, 49 retornos HTTP 409 de conflito e o saldo final de estoque mantido em zero.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
