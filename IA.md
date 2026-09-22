# 🤖 Declaração de Uso de Inteligência Artificial (IA)

> **Projeto Integrador IV · Marketplace Origem (2026.2)**  
> **Disciplina:** Fundamentos de Computação Concorrente, Paralela e Distribuída (FCCPD)  
> **Instituição:** CESAR School  

---

## 1. Declaração Formal de Uso

Em conformidade com as diretrizes de integridade acadêmica e os critérios de avaliação e transparência das disciplinas do **Projeto Integrador IV** e de **Fundamentos de Computação Concorrente, Paralela e Distribuída (FCCPD)**, a equipe declara que utilizou ferramentas de **Inteligência Artificial Generativa (IA)** como assistente de desenvolvimento, pair programming e estruturação técnica durante a concepção e implementação desta Prova de Conceito (PoC).

---

## 2. Ferramentas Utilizadas

* **Modelo / Ferramenta:** Google Antigravity IDE / Gemini 3.7.
* **Função Principal:** Assistente de arquitetura de software, geração de código-base (*scaffolding*), apoio na modelagem de concorrência e escrita de testes de estresse automatizados.

---

## 3. Escopo e Áreas de Atuação da IA no Projeto

A ferramenta de Inteligência Artificial atuou nas seguintes frentes técnicas:

1. **Interpretação e Alinhamento com a Rubrica de FCCPD:**
   - Apoio no desdobramento dos requisitos de concorrência (prevenção de *race condition* e *overselling* com controle transacional ACID) e mensageria assíncrona (desacoplamento via filas/workers com SLAs $\le 300\text{ ms}$).

2. **Scaffolding e Configuração do Projeto Spring Boot:**
   - Estruturação inicial do projeto via Spring Initializr (Maven, Java 17+/25 LTS, Spring Data JPA, Web, driver PostgreSQL).
   - Configuração do datasource JDBC e HikariCP para conexão remota segura com o banco PostgreSQL no Supabase.

3. **Arquitetura de Concorrência e Bloqueio em Memória:**
   - Sugestão e implementação do padrão de **bloqueio por produto (*fine-grained locking*)** através de `ConcurrentHashMap<String, ReentrantLock>` com política de equidade (*fair lock*).
   - Identificação do ponto crítico de acoplamento entre o lock em memória e o commit transacional (`TransactionTemplate`), garantindo que o lock só seja liberado após a gravação definitiva no banco (`COMMIT`), impedindo leituras sujas (*stale reads*).

4. **Desacoplamento Assíncrono e Resiliência:**
   - Configuração de um pool dedicado de threads (`ThreadPoolTaskExecutor` com `@EnableAsync`).
   - Implementação do serviço de mensageria assíncrono com simulação de latência de rede, rastreamento de estados (`pending` $\rightarrow$ `sent` / `failed`) e algoritmo de **retentativas automáticas (até 3 tentativas) com recuo temporizado (*backoff*)**.

5. **Engenharia de Testes de Estresse e Integração:**
   - Elaboração de testes concorrentes multi-thread utilizando `CountDownLatch` e `ExecutorService` para simulação precisa de 10 threads disputando simultaneamente 3 unidades de estoque.
   - Construção de testes de desacoplamento temporal com `Awaitility` para validar a resposta imediata da thread principal (< 200ms) em relação à execução em background.

---

## 4. Responsabilidade, Revisão Humana e Validação

A equipe de estudantes reitera que **todo o código-fonte, arquitetura e documentação gerados com o suporte da IA foram criteriosamente analisados, revisados, compreendidos e validados humanamente**. 

As seguintes etapas de validação foram conduzidas pelos autores:
* **Revisão Técnica de Código:** Análise linha a linha das classes geradas, assegurando aderência aos padrões de código limpo, SOLID e boas práticas de concorrência em Java.
* **Auditoria de Concorrência:** Verificação do comportamento do `ReentrantLock` e garantia da ausência de deadlocks e contenção global.
* **Execução em Ambiente Real:** Compilação e execução de 100% da suíte de testes (`./mvnw clean install` e `./mvnw test`) conectada ao banco de dados relacional remoto no Supabase.
* **Domínio Teórico:** A equipe está plenamente capacitada para apresentar, defender e justificar as decisões arquiteturais e técnicas adotadas perante a banca examinadora.

---

**Equipe Responsável pelo Projeto Origem — 2026.2**
