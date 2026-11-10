# 🏺 Origem — Marketplace da Economia Criativa de Pernambuco
### Projeto Integrador: AED + Infraestrutura de Software · Análise e Desenvolvimento de Sistemas (2026.2)
**CESAR School · 3º / 4º Semestre**

---

## 📖 Sobre o Projeto

O **Origem** é uma aplicação web *full stack* concebida para fortalecer a economia criativa e o artesanato tradicional do estado de Pernambuco. 

Artesãos e mestres populares frequentemente enfrentam invisibilidade digital, dependem de intermediários comerciais que reduzem sua margem de renda e lidam com uma gestão precária de catálogo, pedidos e estoque. O **Origem** conecta essa produção autêntica diretamente a compradores em âmbito nacional, valorizando o **território de origem**, a **técnica tradicional** *(cerâmica figurativa, renda renascença, xilogravura, marcenaria, etc.)* e a **história de quem faz**.

---

## 🛠️ Stack Tecnológica Identificada e Justificativas Técnicas

A squad do projeto adotou a seguinte composição tecnológica:

1. **Linguagem Backend: Java (17+ / 25 LTS)**
   - *Justificativa:* Linguagem fortemente tipada, madura e com suporte de primeira classe a threads, sincronização (`ReentrantLock`, `Condition`, `synchronized`) e escalabilidade em servidores de infraestrutura Linux.
2. **Framework Backend: Spring Boot 4.1.1 (Spring Data JPA / Spring Web MVC / HikariCP)**
   - *Justificativa:* Framework robusto e produtivo para construção de APIs REST empresariais, com injeção de dependências desacoplada, gerenciamento eficiente de pool de conexões com HikariCP e controle transacional ACID com bloqueio pessimista (`@Lock(LockModeType.PESSIMISTIC_WRITE)`).
3. **Interface / Frontend: React 18 + TypeScript + Vite + Tailwind CSS**
   - *Justificativa:* O React com TypeScript garante interface rica, componentizada e livre de erros de tipo em tempo de desenvolvimento. O Vite oferece Hot Module Replacement (HMR) quase instantâneo, e o Tailwind CSS permite criar um Design System coeso, responsivo e adaptado à identidade cultural do artesanato pernambucano.
4. **Biblioteca de Testes: JUnit 5 (JUnit Platform) + Spring Boot Test + H2 Database (Test Scope)**
   - *Justificativa:* Padrão da indústria em Java para testes automatizados unitários e de integração, com asserções fluídas, relatórios limpos no Maven Surefire e simulação em memória de banco de dados relacional isolado para garantir testes rápidos e determinísticos.

---

## 🧠 Algoritmos e Estruturas de Dados (AED) — Implementados do Zero

Todas as estruturas e algoritmos solicitados foram construídos manualmente no pacote `com.origem.ed`, **sem utilizar qualquer coleção ou algoritmo pronto da linguagem** (sem `ArrayList`, `LinkedList`, `Stack`, `Queue`, `HashMap`, `Arrays.sort()`, etc.):

- **Estruturas de Dados Lineares e Não-Lineares (`com.origem.ed.estrutura`):**
  - `ListaEncadeada<T>`: Lista simplesmente encadeada dinâmica com inserção, remoção e busca por valor e índice.
  - `Pilha<T>`: Pilha LIFO com operações `push`, `pop`, `peek`, `estaVazia` e `tamanho`.
  - `Fila<T>`: Fila FIFO encadeada com operações `enfileirar`, `desenfileirar`, `primeiro`, `estaVazia` e `tamanho`.
  - `FilaCircular<T>`: Fila baseada em vetor estático com aritmética modular `(fim + 1) % capacidade`, ideal para buffers de telemetria.
  - `TabelaHash<K, V>`: Tabela hash com baldes (buckets), encadeamento para tratamento de colisão e *rehashing* automático quando o fator de carga atinge 0.75.
  - `ArvoreBinariaBusca<T>`: Árvore Binária de Busca (BST) completa, com inserção ordenada, busca recursiva, remoção cobrindo os 3 casos clássicos (folha, 1 filho e 2 filhos com sucessor in-order) e percursos `emOrdem`, `preOrdem` e `posOrdem`.

- **Algoritmos de Ordenação (`com.origem.ed.algoritmo.Ordenacao`):**
  - `insertionSort`: In-place, $O(n)$ melhor caso, $O(n^2)$ médio/pior.
  - `selectionSort`: In-place, número mínimo de trocas ($O(n)$ swaps), $O(n^2)$ comparações.
  - `mergeSort`: Divisão e conquista estável, garantia estrita de $O(n \log n)$ em todos os casos.
  - `quickSort`: Particionamento in-place com escolha otimizada de pivô mediano, $O(n \log n)$ médio.

- **Algoritmos de Busca (`com.origem.ed.algoritmo.Busca`):**
  - `buscaSequencial`: Varredura linear $O(n)$ para vetores desordenados.
  - `buscaBinaria`: Busca logarítmica $O(\log n)$ por divisão de intervalo para vetores previamente ordenados.

---

## ⚡ Concorrência e Infraestrutura de Software

- **Produtor-Consumidor com Buffer Compartilhado (`com.origem.concorrencia`):**
  - **Versão com Race Condition (`BufferInseguro`):** Múltiplas threads alteram simultaneamente ponteiros e contadores sem trava, provocando perda de atualizações, leituras nulas e corrupção comprovada.
  - **Versão Corrigida com Mutex/Lock (`BufferSincronizado`):** Utiliza `ReentrantLock(fair=true)` e variáveis de condição (`Condition naoCheio` / `naoVazio`), eliminando *busy-wait* e garantindo 100% de consistência entre itens produzidos e consumidos.
  - **Classe de Demonstração:** [`ProdutorConsumidorDemonstracao.java`](./src/main/java/com/origem/concorrencia/ProdutorConsumidorDemonstracao.java) compara e exibe no console os dois cenários.
- **Mapa de Técnicas:** Tabela completa relacionando técnica, localização, justificativa de uso e complexidade em [`docs/mapa-de-tecnicas.md`](./docs/mapa-de-tecnicas.md).
- **Script de Monitoramento para Amazon Linux 2023:** [`monitor.sh`](./monitor.sh) coleta a cada 5 segundos métricas de CPU, RAM, disco e Top 5 processos, salvando em `monitor.log` com data e hora.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- **Java JDK 17+** (ou Java 25 LTS)
- **Node.js 18+** e **npm**
- **Bash** (para o script de monitoramento no Linux)

### 1. Backend (API Spring Boot)
```bash
# No Linux/macOS:
./mvnw spring-boot:run

# No Windows (PowerShell / CMD):
.\mvnw.cmd spring-boot:run
```
A API iniciará por padrão na porta `8080`.

### 2. Demonstração Concorrente Produtor-Consumidor (Terminal)
Para executar a comparação entre o buffer com race condition e o buffer com Mutex:
```bash
# Compilar e executar a classe demonstrativa:
.\mvnw.cmd compile exec:java -Dexec.mainClass="com.origem.concorrencia.ProdutorConsumidorDemonstracao"
```

### 3. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Acesse a aplicação no navegador em `http://localhost:5173`.

### 4. Script de Monitoramento (Amazon Linux 2023 / Linux)
```bash
# Conceder permissão de execução:
chmod +x monitor.sh

# Executar monitoramento (registra no terminal e em monitor.log a cada 5 segundos):
./monitor.sh
```

---

## 🧪 Como rodar os testes

### 1. Tabela de Classes de Teste por Grupo

| Grupo | Classe de Teste | O que testa (1 linha) |
| :--- | :--- | :--- |
| **Compra e Pedidos (API REST)** | `com.origem.controller.OrderControllerTest` | Testa os endpoints HTTP REST de checkout (`POST /orders/purchase`) para sucesso, produto inexistente e estoque insuficiente. |
| **Estoque Concorrente e Notificações** | `com.origem.service.OrderReliabilityConcurrencyAndAsyncTest` | Testa baixa atômica de estoque sob 10 requisições concorrentes com Lock Pessimista e processamento/retentativas da fila assíncrona. |
| **Inicialização da Aplicação** | `com.origem.OrigemApplicationTests` | Valida o carregamento integral do contexto do Spring Boot, JPA EntityManager e repositórios. |
| **Estruturas de Dados (AED)** | `com.origem.ed.estrutura.ListaEncadeadaTest` | Testa inserção (início/fim/posição), remoção, busca e conversão para array em lista simplesmente encadeada. |
| **Estruturas de Dados (AED)** | `com.origem.ed.estrutura.PilhaTest` | Testa operações de empilhar, desempilhar e consulta de topo respeitando a política LIFO. |
| **Estruturas de Dados (AED)** | `com.origem.ed.estrutura.FilaTest` | Testa enfileirar e desenfileirar garantindo a ordem estrita de atendimento FIFO. |
| **Estruturas de Dados (AED)** | `com.origem.ed.estrutura.FilaCircularTest` | Testa buffer estático com ponteiros modulares circulares e validação de limites de capacidade. |
| **Estruturas de Dados (AED)** | `com.origem.ed.estrutura.TabelaHashTest` | Testa pares chave-valor, tratamento de colisões por encadeamento separado e redimensionamento automático (*rehashing*). |
| **Estruturas de Dados (AED)** | `com.origem.ed.estrutura.ArvoreBinariaBuscaTest` | Testa inserção na BST, percurso em-ordem e os 3 casos de remoção (folha, 1 filho e 2 filhos com sucessor). |
| **Algoritmos de Ordenação e Busca** | `com.origem.ed.algoritmo.OrdenacaoTest` | Testa ordenação in-place e estável com Insertion Sort, Selection Sort, Merge Sort e Quick Sort. |
| **Algoritmos de Ordenação e Busca** | `com.origem.ed.algoritmo.BuscaTest` | Testa busca sequencial (linear) em dados arbitrários e busca binária logarítmica em dados ordenados. |
| **Concorrência (Threads)** | `com.origem.concorrencia.ProdutorConsumidorTest` | Evidencia anomalias de *Race Condition* no buffer inseguro e valida consistência total no buffer com Lock/Mutex. |

---

### 2. Comandos Maven por Grupo

Execute no terminal (Linux/macOS use `./mvnw`, Windows use `.\mvnw.cmd`):

* **Grupo 1 — Compra e Pedidos (API REST):**
  ```bash
  mvn test -Dtest=OrderControllerTest
  ```
* **Grupo 2 — Concorrência de Estoque e Notificações Assíncronas:**
  ```bash
  mvn test -Dtest=OrderReliabilityConcurrencyAndAsyncTest
  ```
* **Grupo 3 — Inicialização da Aplicação:**
  ```bash
  mvn test -Dtest=OrigemApplicationTests
  ```
* **Grupo 4 — Estruturas de Dados (AED):**
  ```bash
  mvn test -Dtest="com.origem.ed.estrutura.*Test"
  ```
* **Grupo 5 — Algoritmos de Ordenação e Busca (AED):**
  ```bash
  mvn test -Dtest="com.origem.ed.algoritmo.*Test"
  ```
* **Grupo 6 — Concorrência e Threads (Produtor-Consumidor):**
  ```bash
  mvn test -Dtest=ProdutorConsumidorTest
  ```

---

### 3. Comando para Rodar TODOS os Testes de uma Vez

```bash
mvn test
```
*(No Windows PowerShell / CMD: `.\mvnw.cmd test`)*

---

## 📝 Decisões de Projeto e Simplificações Adotadas

1. **Banco em Memória nos Testes Automatizados:**  
   Para garantir que a suíte de testes execute de forma 100% autônoma, rápida e sem depender de credenciais externas ativas da nuvem (Supabase), foi configurado um banco em memória H2 (modo PostgreSQL) com escopo restrito a testes (`<scope>test</scope>` em `pom.xml` e `src/test/resources/application.properties`). As configurações de produção permanecem preservadas para PostgreSQL.
2. **Tratamento de Colisão na Tabela Hash:**  
   Adotou-se o modelo clássico de **Encadeamento Separado (Separate Chaining)** com lista encadeada interna nos baldes e fator de carga máximo de 0.75, garantindo simplicidade de implementação e complexidade $O(1)$ amortizada.
3. **Condição de Corrida no Buffer Inseguro:**  
   O buffer inseguro intencionalmente omite qualquer trava de seção crítica e utiliza pequenas alternâncias de escalonamento (`Thread.yield()`), evidenciando perdas de dados e corrupção de ponteiros de forma determinística sob alta carga concorrente.

---

## 📁 Estrutura da Documentação do Projeto

* 🗺️ **[Mapa de Técnicas (AED e Infraestrutura)](./docs/mapa-de-tecnicas.md):** Tabela detalhada de técnicas, locais no código, justificativas e complexidade.
* 🏛️ **[Requisitos e Arquitetura](./docs/01-requisitos-e-arquitetura/):** Análise de domínio, modelagem conceitual UML e princípios SOLID.
* 🗄️ **[Banco de Dados](./docs/02-banco-de-dados/):** Modelo ER, modelo lógico relacional, normalização e scripts DDL.
* ⚡ **[Computação Concorrente e Distribuída (FCCPD)](./docs/03-computacao-concorrente-distribuida/01-concorrencia-e-mensageria.md):** Controle de concorrência no checkout e consistência transacional.
* 🤖 **[Engenharia de Software e IA](./docs/04-engenharia-software-e-ia/):** Formulação de recomendação e métricas.
* 🌐 **[Desenvolvimento Web](./docs/05-desenvolvimento-web/):** Frontend responsivo e design system.
* 💻 **[Código do Frontend](./frontend/README.md):** Vitrine e componentes do marketplace.
