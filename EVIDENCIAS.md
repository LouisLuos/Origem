# ⚡ Relatório de Evidências — PoC de Concorrência e Processamento Assíncrono

> **Projeto Integrador IV · Marketplace Origem (2026.2)**  
> **Disciplina:** Fundamentos de Computação Concorrente, Paralela e Distribuída (FCCPD)  
> **Professor(a):** Banca Avaliadora de FCCPD  
> **Repositório:** `Origem`  

---

## 1. Visão Geral da Prova de Conceito (PoC)

Esta PoC foi desenvolvida e validada em **Spring Boot (Java 17+/25 LTS)** integrado a um banco de dados relacional **PostgreSQL (Supabase)**, com o objetivo de comprovar os dois pilares centrais da rubrica de FCCPD:

1. **Controle Estrito de Concorrência no Checkout/Estoque:** Prevenção absoluta de *Race Conditions* e *Overselling* (venda dupla de peças artesanais com estoque restrito) através de bloqueio fino em memória (*fine-grained in-memory locking*).
2. **Processamento Assíncrono e Desacoplamento:** Desacoplamento da thread HTTP de requisição principal de tarefas I/O-intensivas (notificações/mensageria) através de workers assíncronos (`@Async`), com ciclo de vida rastreável (`pending` $\rightarrow$ `sent` / `failed`) e política de retentativas (*retry/backoff*).

---

## 2. Testes de Concorrência e Consistência (Peso: 45%)

### 2.1 Mecanismo Implementado: Fine-Grained Locking + Transação Protegida
* **Estrutura:** `ConcurrentHashMap<String, ReentrantLock>` no serviço [`OrderService.java`](./src/main/java/com/origem/service/OrderService.java).
* **Política de Equidade:** O `new ReentrantLock(true)` (*Fair Lock*) garante que requisições simultâneas disputando o mesmo produto entrem em fila ordenada (FIFO).
* **Paralelismo Real:** Requisições para produtos com IDs distintos adquirem locks independentes, executando em paralelo sem bloqueio mútuo.
* **Integridade Transacional Crítica:** O `TransactionTemplate` é executado **dentro** do bloco protegido pelo lock (`lock.lock()` ... `lock.unlock()`). O `COMMIT` no PostgreSQL ocorre antes da liberação do lock, eliminando a janela de leitura suja (*dirty/stale read*) sob o nível de isolamento `READ COMMITTED`.

---

### 2.2 Cenário de Teste 1: Corrida Crítica por Estoque Restrito (10 Threads disputando 3 Unidades)
* **Classe de Teste:** [`OrderServiceConcurrencyTest.java`](./src/test/java/com/origem/service/OrderServiceConcurrencyTest.java)
* **Condição Inicial:** Produto `poc-test-concurrency-item` inicializado no banco com **estoque = 3**.
* **Carga:** **10 threads concorrentes** disparadas exatamente no mesmo instante utilizando `CountDownLatch` (largada sincronizada).
* **Resultado Obtido:**
  * **3 compras bem-sucedidas** (estoque decrementado atomicamente: $3 \rightarrow 2 \rightarrow 1 \rightarrow 0$).
  * **7 compras rejeitadas** com `InsufficientStockException` (mapeada para HTTP 409 Conflict).
  * **Estoque final no banco:** **Estritamente 0** (ausência total de overselling ou inconsistência).

```text
[THREAD-pool-3-thread-4] Estoque atual do produto: 3, Quantidade solicitada: 1 -> Sucesso: Estoque atualizado para 2
[THREAD-pool-3-thread-6] Estoque atual do produto: 2, Quantidade solicitada: 1 -> Sucesso: Estoque atualizado para 1
[THREAD-pool-3-thread-1] Estoque atual do produto: 1, Quantidade solicitada: 1 -> Sucesso: Estoque atualizado para 0
[THREAD-pool-3-thread-3] Estoque atual do produto: 0, Quantidade solicitada: 1 -> Falha: estoque insuficiente!
[THREAD-pool-3-thread-5] Estoque atual do produto: 0, Quantidade solicitada: 1 -> Falha: estoque insuficiente!
...
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

---

### 2.3 Cenário de Teste 2: Paralelismo de Produtos Distintos
* Duas threads efetuam compras simultâneas para `poc-test-prod-a` e `poc-test-prod-b`.
* **Evidência dos Logs:** Ambos os locks foram adquiridos exatamente no mesmo timestamp (`10:06:54.306`), comprovando que produtos diferentes não sofrem gargalo de concorrência global.

---

### 📸 Espaço para Print 1: Log do Teste de Concorrência (`OrderServiceConcurrencyTest`)
*(Cole aqui a captura de tela do terminal exibindo o disparo das 10 threads, a transição do estoque até 0 e as exceções 409 controladas)*

```
[ INSERIR PRINT DO TERMINAL - CONCORRÊNCIA E OVERSELLING PREVENIDO ]
```

---

## 3. Testes de Processamento Assíncrono e Mensageria (Peso: 35%)

### 3.1 Mecanismo Implementado: Workers Assíncronos e Pool Dedicado
* **Pool Dedicado:** [`AsyncConfig.java`](./src/main/java/com/origem/config/AsyncConfig.java) provê um `ThreadPoolTaskExecutor` com prefixo `async-notification-` (evitando thread exhaustion).
* **Desacoplamento Completo:** A thread de requisição HTTP grava imediatamente o registro na tabela `notification` como `'pending'` e despacha a execução em background via [`NotificationService.java`](./src/main/java/com/origem/service/NotificationService.java).
* **Tempo de Resposta ao Cliente:** A resposta HTTP 200 é devolvida em **menos de 200ms**, enquanto o worker simula a latência de envio (2000ms de I/O de rede).

---

### 3.2 Cenário de Teste 3: Transição Assíncrona `'pending'` $\rightarrow$ `'sent'`
* **Classe de Teste:** [`NotificationServiceAsyncTest.java`](./src/test/java/com/origem/service/NotificationServiceAsyncTest.java)
* **Evidência Temporal:**
  - A thread principal concluiu em **150ms** e liberou o chamador.
  - A notificação foi verificada inicialmente no banco como `'pending'`.
  - A thread de worker `async-notification-3` executou em segundo plano e, após o envio, atualizou o status para `'sent'`.

---

### 3.3 Cenário de Teste 4: Tolerância a Falhas e 3 Retentativas $\rightarrow$ `'failed'`
* **Simulação de Indisponibilidade de Gateway:**
  - Tentativa 1/3: Falha simulada $\rightarrow$ Log de aviso $\rightarrow$ Espera backoff de 500ms.
  - Tentativa 2/3: Falha simulada $\rightarrow$ Log de aviso $\rightarrow$ Espera backoff de 500ms.
  - Tentativa 3/3: Falha simulada $\rightarrow$ Esgotamento de tentativas.
  - **Resultado no Banco de Dados:** Registro transita automaticamente para `'failed'` (simulação de envio para Dead Letter Queue / DLQ).

```text
2026-09-22T10:06:50.422 [THREAD: async-notification-4] Tentativa 1/3 de envio da notificação...
2026-09-22T10:06:50.623 [THREAD: async-notification-4] Falha na tentativa 1/3: Falha simulada. Aguardando backoff...
2026-09-22T10:06:51.123 [THREAD: async-notification-4] Tentativa 2/3 de envio da notificação...
2026-09-22T10:06:51.324 [THREAD: async-notification-4] Falha na tentativa 2/3: Falha simulada. Aguardando backoff...
2026-09-22T10:06:51.825 [THREAD: async-notification-4] Tentativa 3/3 de envio da notificação...
2026-09-22T10:06:52.025 [THREAD: async-notification-4] ERRO: Notificação ID: 88bb04ac... esgotou todas as 3 tentativas. Atualizada para status 'failed'.
```

---

### 📸 Espaço para Print 2: Log do Teste Assíncrono e Retentativas (`NotificationServiceAsyncTest`)
*(Cole aqui a captura de tela do terminal demonstrando o retorno imediato da thread principal e as 3 tentativas do worker com transição final para 'failed')*

```
[ INSERIR PRINT DO TERMINAL - ASYNC, BACKOFF E TRANSIÇÃO DE STATUS ]
```

---

## 4. Resumo de Execução da Suíte Completa de Testes

* **Comando Executado:** `./mvnw.cmd test`
* **Ambiente:** Windows 11, JDK 25 LTS, Apache Maven 3.9.x, PostgreSQL 17.6 (Supabase).
* **Total de Testes Executados:** **10 testes em 4 classes de teste**.
* **Status:** **0 Falhas, 0 Erros, 0 Ignorados — `BUILD SUCCESS`**.

| Classe de Teste | Quantidade | Propósito | Resultado |
| :--- | :---: | :--- | :---: |
| `OrigemApplicationTests` | 2 | Carga do contexto Spring e conectividade com o Supabase | Aprovado |
| `OrderServiceConcurrencyTest` | 2 | 10 Threads concorrentes (sem overselling) + Paralelismo | Aprovado |
| `NotificationServiceAsyncTest` | 2 | Desacoplamento (< 200ms), transição `pending` $\rightarrow$ `sent`, 3 retries $\rightarrow$ `failed` | Aprovado |
| `OrderControllerTest` | 4 | Endpoints REST HTTP 200, 409 (Conflito), 404 e 400 | Aprovado |

---

### 📸 Espaço para Print 3: Sucesso do Build Geral (`mvn test` / `BUILD SUCCESS`)
*(Cole aqui a captura de tela final do terminal evidenciando `BUILD SUCCESS` com 10 testes aprovados)*

```
[ INSERIR PRINT DO TERMINAL - BUILD SUCCESS TOTAL ]
```
