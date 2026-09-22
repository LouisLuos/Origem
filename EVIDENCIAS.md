# ⚡ Relatório de Evidências — Concorrência, Consistência e Processamento Assíncrono

> **Projeto Integrador IV · Marketplace Origem (2026.2)**  
> **Disciplina:** Fundamentos de Computação Concorrente, Paralela e Distribuída (FCCPD)  
> **Professor(a):** Banca Avaliadora de FCCPD  
> **Repositório:** `Origem`  

---

## 1. Visão Geral da Implementação

Esta implementação foi desenvolvida e validada em **Spring Boot (Java 17+/25 LTS)** integrado a um banco de dados relacional real em produção **PostgreSQL 17.6 (Supabase)**, atendendo com rigor aos 6 requisitos estabelecidos:

1. **Requisito 1 & 2 — Controle de Concorrência e Consistência no Estoque:**
   - Adotado **UM ÚNICO mecanismo** de controle de concorrência a nível de banco de dados: **Lock Pessimista Exclusivo (`SELECT ... FOR UPDATE`)** via JPA `@Lock(LockModeType.PESSIMISTIC_WRITE)`.
   - Nenhuma trava em memória (sem `ReentrantLock` ou `ConcurrentHashMap`), delegando a garantia de consistência ACID diretamente ao PostgreSQL.
   - O estoque nunca fica negativo e é protegido deterministicamente contra *overselling*.
2. **Requisito 3 & 4 — Fila de Tarefas Assíncronas e Integridade:**
   - Fila de segundo plano implementada utilizando **o próprio banco de dados relacional** (tabela `notification`), sem dependência de brokers externos (sem Redis ou RabbitMQ).
   - Cada tarefa é gravada com status inicial `'pending'`. O endpoint principal responde ao usuário imediatamente, sem esperar o término do processamento.
   - Resiliência garantida por **até 3 tentativas com intervalo fixo** entre elas (sem backoff progressivo). Falhas definitivas transitam para `'failed'` mantendo o registro permanentemente salvo.
3. **Requisito 5 — Evidência de Confiabilidade com Teste Único:**
   - **UM único teste automatizado unificado** ([`OrderReliabilityConcurrencyAndAsyncTest.java`](./src/test/java/com/origem/service/OrderReliabilityConcurrencyAndAsyncTest.java)) disparando 10 requisições de compra simultâneas para um item com estoque inicial = 3.
   - Valida conjuntamente: (a) estoque final exatamente zerado e nunca negativo, e (b) 100% das tarefas assíncronas geradas persistidas e processadas para `'sent'` (nenhuma perdida).
   - Saída estruturada e legível no console/relatório.
4. **Requisito 6 — Declaração de Uso de IA:**
   - Documento [`IA.md`](./IA.md) discriminando as frentes de uso e o processo de compreensão e auditoria técnica conduzido pela equipe.

---

## 2. Justificativa Técnica do Mecanismo de Concorrência (Requisito 1 e 2)

### Mecanismo: Bloqueio Pessimista a Nível de Banco de Dados (`SELECT ... FOR UPDATE`)
* **Código Implementado:**
  ```java
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT p FROM Product p WHERE p.id = :id")
  Optional<Product> findByIdForUpdate(@Param("id") String id);
  ```
* **Por que é o mais adequado para o cenário?**
  1. **Itens com Estoque Baixo/Exclusivo e Picos de Acesso (*Flash Crowds*):**
     Peças de artesanato exclusivo têm estoque unitário ou muito baixo (`estoque = 1` a `3`). Se usássemos *Lock Otimista* (`@Version`), dezenas de requisições concorrentes leriam a mesma versão e tentariam comitar, gerando tempestades de conflitos (`OptimisticLockException`), *rollbacks* em massa e saturação inútil de conexões e CPU com retentativas.
  2. **Garantia Nativa a Nível de Banco de Dados:**
     Diferente de locks em memória (que falham se a aplicação escalar horizontalmente para múltiplas instâncias ou reiniciar), o bloqueio pessimista opera diretamente no gerenciador de locks de tupla do PostgreSQL (`XMAX`). A primeira transação obtém a trava exclusiva da linha, decrementa o estoque e executa o `COMMIT`. A próxima transação na fila do banco acorda, lê o saldo já decrementado e, constatando indisponibilidade, é rejeitada de imediato com `InsufficientStockException`, garantindo atomicidade ACID e impedindo saldo negativo.

---

## 3. Fila Assíncrona no Banco de Dados Relacional (Requisito 3 e 4)

* **Armazenamento:** Tabela relacional `notification` (`id`, `order_id`, `status`).
* **Ciclo de Vida:**
  $$\text{Requisição HTTP} \xrightarrow{\text{Gravação inicial}} \text{'pending'} \xrightarrow{\text{Despacho @Async}} \text{Liberação do 200 OK}$$
  $$\text{Worker de Background} \xrightarrow{\text{Até 3 tentativas (intervalo fixo)}} \begin{cases} \text{Sucesso} \rightarrow \text{'sent'} \\ \text{Esgotamento} \rightarrow \text{'failed'} \quad (\text{Registro Preservado}) \end{cases}$$
* **Desacoplamento Comprovado:** A resposta do checkout é devolvida ao comprador imediatamente após a persistência da notificação como `'pending'`, sem aguardar a conclusão do processamento em segundo plano.

---

## 4. Evidência do Teste Único de Confiabilidade (Requisito 5)

* **Classe de Teste:** [`OrderReliabilityConcurrencyAndAsyncTest.java`](./src/test/java/com/origem/service/OrderReliabilityConcurrencyAndAsyncTest.java)
* **Cenário:** Produto `poc-test-reliability-item` com **estoque = 3** disputado por **10 threads concorrentes** disparadas simultaneamente via `CountDownLatch`.

### Saída Estruturada Gerada pelo Teste no Console:
```text
================================================================================
RELATÓRIO DE CONFIABILIDADE: CONCORRÊNCIA E FILA ASSÍNCRONA (REQUISITO 5)
================================================================================
1. PARÂMETROS DA EXECUÇÃO:
   - Produto ID: poc-test-reliability-item
   - Estoque Inicial: 3 unidades
   - Requisições Concorrentes Disparadas: 10 threads
   - Quantidade Solicitada por Requisição: 1 unidade
--------------------------------------------------------------------------------
2. CONTROLE DE CONCORRÊNCIA E ESTOQUE NO BANCO (REQUISITOS 1 E 2):
   - Compras Confirmadas (Sucesso): 3
   - Compras Rejeitadas (Estoque Esgotado): 7
   - Estoque Final no PostgreSQL: 0 unidades
   - Saldo Negativo Prevenido: SIM (Estoque >= 0 comprovado)
   - Overselling Prevenido: SIM (Vendas <= Estoque Inicial comprovado)
   - Mecanismo Utilizado: Lock Pessimista Exclusivo (SELECT ... FOR UPDATE)
   - Status Concorrência: APROVADO [100%]
--------------------------------------------------------------------------------
3. FILA DE TAREFAS ASSÍNCRONAS NO BANCO (REQUISITOS 3 E 4):
   - Tarefas Registradas Inicialmente ('pending'): 3
   - Tarefas Processadas pelo Worker ('sent'): 3
   - Tarefas Perdidas no Banco: 0
   - Política de Retentativas: Até 3 tentativas com intervalo fixo (300ms)
   - Status Fila Assíncrona: APROVADO [100%]
================================================================================
RESULTADO GERAL: SUCESSO TOTAL — REQUISITOS 1, 2, 3, 4 E 5 ATENDIDOS INTEGRALMENTE
================================================================================
```

---

## 5. Resumo Geral de Execução da Suíte de Testes

* **Comando Executado:** `./mvnw.cmd test`
* **Ambiente de Produção:** Windows 11, JDK 25 LTS, Apache Maven 3.9.x, PostgreSQL 17.6 (Supabase).
* **Resultado:** **7 testes executados, 0 Falhas, 0 Erros, 0 Ignorados — `BUILD SUCCESS`**.

| Classe de Teste | Quantidade | Escopo | Resultado |
| :--- | :---: | :--- | :---: |
| `OrigemApplicationTests` | 2 | Carga de contexto e integridade do datasource | Aprovado |
| `OrderControllerTest` | 4 | Endpoints HTTP (200 OK, 409 Conflict, 404, metadados) | Aprovado |
| `OrderReliabilityConcurrencyAndAsyncTest` | 1 | **Teste Único de Confiabilidade:** Concorrência no BD + Consistência de Estoque + Fila Assíncrona | Aprovado |

---

```
[ BUILD SUCCESS - 100% DOS TESTES APROVADOS CONTRA POSTGRESQL REAL ]
```
