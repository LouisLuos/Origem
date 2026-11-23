# 🤖 Declaração de Uso de Inteligência Artificial (IA) — Requisito 6

> **Projeto Integrador IV · Marketplace Origem (2026.2)**  
> **Disciplina:** Fundamentos de Computação Concorrente, Paralela e Distribuída (FCCPD)  
> **Instituição:** CESAR School  

---

## 1. Declaração Formal de Uso

Em conformidade com as diretrizes de transparência e integridade acadêmica da disciplina de **Fundamentos de Computação Concorrente, Paralela e Distribuída (FCCPD)**, a equipe declara que utilizou ferramentas de **Inteligência Artificial (IA)** como suporte técnico no desenvolvimento dos ajustes de concorrência, fila assíncrona e testes de confiabilidade.

Abaixo discrimina-se com precisão em quais frentes técnicas a IA atuou e o respectivo processo de compreensão e validação humana conduzido pela equipe.

---

## 2. Partes Específicas em que a IA foi Utilizada

### 2.1 Controle de Concorrência e Consistência no Estoque (Requisitos 1 e 2)
* **Atuação da IA:** 
  A IA auxiliou na especificação e refatoração do mecanismo de concorrência, orientando a eliminação de travas em memória da JVM (`ReentrantLock`) para a adoção estrita de **UM ÚNICO mecanismo a nível de banco de dados**: Bloqueio Pessimista Exclusivo via JPA (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) associado ao `SELECT ... FOR UPDATE` do PostgreSQL. A IA também auxiliou na amarração transacional com o `TransactionTemplate`.
* **Compreensão e Validação pela Equipe:** 
  A equipe revisou a consulta SQL gerada (`SELECT ... FROM product WHERE id = ? FOR UPDATE`) e compreendeu a semântica do bloqueio de tuplas no PostgreSQL (`XMAX`). Foi validado que, em cenários de estoque unitário/baixo com picos de requisições simultâneas (*flash crowds*), o lock pessimista é superior ao lock otimista (`@Version`), pois serializa diretamente a linha no banco e elimina tempestades de exceções de concorrência e *rollbacks* custosos. A equipe conferiu que a liberação do lock ocorre estritamente no `COMMIT`, garantindo atomicidade ACID e impedindo saldo negativo e *overselling*.

### 2.2 Fila de Tarefas Assíncronas e Desacoplamento (Requisitos 3 e 4)
* **Atuação da IA:** 
  A IA apoiou na estruturação da fila de segundo plano utilizando exclusivamente a tabela relacional `notification` já existente no PostgreSQL (sem brokers adicionais como Redis ou RabbitMQ). Foram geradas as regras de persistência inicial com status `'pending'`, execução não bloqueante em background via worker `@Async` e a política de **até 3 tentativas com intervalo fixo de repetição (sem backoff progressivo)**, marcando falhas permanentes como `'failed'` sem deleção de registros.
* **Compreensão e Validação pela Equipe:** 
  A equipe analisou a separação entre a thread HTTP do checkout e a thread assíncrona do `notificationTaskExecutor`. Foi validado que o cliente recebe a confirmação da compra imediatamente após o commit do estoque, enquanto o processamento da tarefa ocorre em background. A equipe confirmou que o intervalo fixo atende às restrições do projeto sem complexidade arbitrária de backoff exponencial, garantindo persistência duradoura e auditável das tarefas no banco relacional.

### 2.3 Evidência de Confiabilidade e Teste Único (Requisito 5)
* **Atuação da IA:** 
  A IA foi empregada na construção de **um único teste automatizado unificado** ([`OrderReliabilityConcurrencyAndAsyncTest.java`](./src/test/java/com/origem/service/OrderReliabilityConcurrencyAndAsyncTest.java)), utilizando `CountDownLatch` para sincronização estrita de 10 threads concorrentes disputando 3 unidades de estoque e `Awaitility` para monitoramento da fila assíncrona, além da formatação do relatório consolidado de saída.
* **Compreensão e Validação pela Equipe:** 
  A equipe auditou a mecânica da barreira de sincronização (`startLatch.await()`) para garantir disparo concorrente real contra a instância remota de produção no Supabase (PostgreSQL 17). O teste foi executado via Maven (`./mvnw.cmd test`), comprovando simultaneamente: (a) término com estoque final exatamente zerado ($3 - 3 = 0$) e sem saldo negativo, e (b) 100% das 3 tarefas assíncronas persistidas e transicionadas para `'sent'` sem nenhuma perda.

---

## 3. Síntese do Processo de Auditoria e Domínio Técnico

A equipe assegura que a IA foi empregada como ferramenta de assistência e prototipagem, sendo o projeto integralmente compreendido, inspecionado linha por linha e validado em ambiente relacional real pelos seus integrantes.
