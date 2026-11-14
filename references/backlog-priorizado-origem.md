# Backlog Priorizado Consolidado - Origem

## Documento de Submissão: Backlog Priorizado Consolidado

**Índice**

1. Visão Geral da Atividade e Consolidação de Domínio
2. Metodologia de Priorização (Técnica MoSCoW)
3. Backlog Detalhado por Ordem de Desenvolvimento
4. Rastreabilidade, Governança e Evolução Contínua

---

**Projeto Integrador IV · Origem**
**E-commerce de Artesanato Pernambucano (Marketplace Multi-Origem)**

**Disciplina Principal:** Requisitos, Projeto de Software e Validação · **Semestre:** 2026.2
**Disciplinas Integradas:** Desenvolvimento Web Full Stack · Banco de Dados · Fundamentos de Computação Concorrente, Paralela e Distribuída (FCCPD) · Sistemas Distribuídos e Mensageria
**Referência Metodológica:** INVEST (Bill Wake), BDD / Gherkin (Gojko Adzic / Dan North), SMART Tasks (Doran), MoSCoW (DSDM Framework), Clean Architecture (Robert C. Martin).

**Integrantes do Grupo:** Cauã dos Santos · Eduardo Henrique · Luiz Henrique · Marcos Antônio · Matheus Freitas · Pedro Vinicius · Vinicius Gabriel

---

## 1. Visão Geral da Atividade e Consolidação de Domínio

Este documento consolida o **Backlog Priorizado Oficial** do sistema de **E-commerce de Artesanato Pernambucano**, integrando:

1. **Os aprendizados da Análise de Domínio (DDD) e Modelo Conceitual:** Valorização do artesanato autoral de Pernambuco (polos culturais como Alto do Moura/Caruaru, Tracunhaém, Bezerros, Pesqueira, Goiana; atores: Visitante, Comprador, Artesão/Mestre, Curador e Administrador; peças únicas com estoque unitário, fracionamento em subpedidos por ateliê e liquidação desacoplada via Pix em custódia D + 7);
2. **Os refinamentos de Engenharia de Requisitos:** Escrita padronizada de Histórias de Usuário validadas pelo acrônimo **INVEST** e especificação formal de comportamento orientada a cenários em **BDD / Gherkin** (Dado / Quando / Então);
3. **As diretrizes técnicas das disciplinas integradas:** Arquitetura limpa (Clean Architecture), APIs RESTful idempotentes, concorrência transacional no PostgreSQL com locks e índices de unicidade contra vendas duplicadas (overselling), tarefas assíncronas para notificações e modelagem relacional normalizada com integridade referencial estrita.

---

## 2. Metodologia de Priorização (Técnica MoSCoW)

A priorização de todo o backlog foi estruturada exclusivamente com base na técnica **MoSCoW**, estabelecendo uma hierarquia clara e orientada a valor para o desenvolvimento do produto:

- **Must Have (Essencial / Obrigatório):** Requisitos inegociáveis para a viabilidade operacional, técnica e jurídica do MVP. Sem estas funcionalidades, a plataforma não tem condições de operar transacionalmente (ex.: autenticação, parametrização de ateliê, catalogação com cubagem obrigatória, reserva de 15 minutos, checkout consolidado, desmembramento de subpedidos com seguro, repasse Pix em custódia D + 7, gestão de avarias e direito de arrependimento). Total: **14 Histórias**.
- **Should Have (Importante / Alta Prioridade):** Funcionalidades de alto valor agregado que aumentam a conveniência e eficiência operacional, mas cuja ausência temporária não bloqueia o fluxo principal de compra e venda (ex.: recuperação segura de senha, gestão de lotes limitados com estoque > 1, catálogo de múltiplos endereços de entrega e envio automático de notificações). Total: **4 Histórias**.
- **Could Have (Desejável / Evolução Futura):** Requisitos que trazem melhorias incrementais de experiência e governança avançada, programados para versões posteriores (ex.: agrupamento de frete por polo/vila, recomendação inteligente de peças afins e exportação analítica avançada).
- **Won't Have (Fora de Escopo nesta Versão):** Requisitos deliberadamente descartados para a entrega do MVP a fim de resguardar o cronograma (ex.: encomendas sob medida, chat interno em tempo real e rateio de Pix para múltiplos titulares de cooperativas).

### Matriz Geral do Backlog Ordenado para Desenvolvimento

| Ordem | ID | Épico | História de Usuário | Prioridade MoSCoW | Esforço (Tarefas SMART) |
|---|---|---|---|---|---|
| 1º | HU-01 | Épico 1: Identidade e Acesso | Cadastro Unificado e Autenticação de Usuários | Must Have | 4 tarefas · 16h |
| 2º | HU-03 | Épico 1: Identidade e Acesso | Especialização de Artesão e Blindagem de Curador | Must Have | 4 tarefas · 15h |
| 3º | HU-04 | Épico 2: Gestão do Ateliê | Parametrização do Ateliê e Endereço de Origem | Must Have | 3 tarefas · 11h |
| 4º | HU-05 | Épico 3: Gestão do Acervo | Catalogação com Cubagem Física e Fotos | Must Have | 4 tarefas · 16h |
| 5º | HU-06 | Épico 3: Gestão do Acervo | Gestão de Lotes Limitados e Estoque | Should Have | 3 tarefas · 9h |
| 6º | HU-07 | Épico 4: Vitrine e Busca | Vitrine Cultural com FTS e Simulação de Frete | Must Have | 4 tarefas · 16h |
| 7º | HU-08 | Épico 4: Vitrine e Busca | Perfil Biográfico e Portfólio do Mestre | Must Have | 3 tarefas · 8h |
| 8º | HU-09 | Épico 5: Carrinho e Checkout | Carrinho Fracionado e Reserva Concorrente (Invariante 1) | Must Have | 4 tarefas · 15h |
| 9º | HU-10 | Épico 6: Pagamento | Checkout Unificado e Captura Centralizada Pix/Cartão | Must Have | 4 tarefas · 15h |
| 10º | HU-11 | Épico 6: Pagamento | Livro de Endereços do Comprador (Address Book) | Should Have | 3 tarefas · 8h |
| 11º | HU-12 | Épico 7: Subpedidos e Logística | Desmembramento em Subpedidos e Etiquetas com Seguro | Must Have | 4 tarefas · 15h |
| 12º | HU-13 | Épico 7: Subpedidos e Logística | Rastreamento, SLA de 7 Dias Úteis e Cancelamento | Must Have | 4 tarefas · 14h |
| 13º | HU-14 | Épico 8: Finanças e Custódia | Custódia Pós-Entrega (D + 7) e Liquidação via Pix | Must Have | 4 tarefas · 15h |
| 14º | HU-15 | Épico 9: Avarias e Sinistros | Registro de Avaria em até 48h e Arbitragem de Sinistro | Must Have | 4 tarefas · 14h |
| 15º | HU-16 | Épico 9: Avarias e Sinistros | Exercício do Direito de Arrependimento em 7 Dias (CDC) | Must Have | 3 tarefas · 8h |
| 16º | HU-02 | Épico 1: Identidade e Acesso | Recuperação Segura de Senha | Should Have | 3 tarefas · 9h |
| 17º | HU-17 | Épico 10: Notificações e Admin | Hub de Notificações Transacionais Multicanal | Should Have | 3 tarefas · 9h |
| 18º | HU-18 | Épico 10: Notificações e Admin | Painel Administrativo de Moderação e Auditoria | Must Have | 3 tarefas · 10h |
| **TOTAL** | — | **10 Épicos** | **18 Histórias de Usuário** | **14 Must / 4 Should** | **64 Tarefas · 226h** |

---

## 3. Backlog Detalhado por Ordem de Desenvolvimento

Abaixo, cada uma das 18 Histórias de Usuário está apresentada com sua classificação completa, critérios de aceite em BDD/Gherkin e decomposição técnica em Tarefas SMART, organizadas de forma clara e objetiva na sequência: **1. Banco de Dados**, **2. Backend** e **3. Frontend**, com escopo compreensível e Definition of Done (DoD) mensurável.

---

### [Ordem 01] HU-01 · Cadastro Unificado e Autenticação de Usuários

- **Épico:** Épico 1: Identidade, Acesso e Governança de Perfis
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** visitante da plataforma, ***quero*** me cadastrar e autenticar informando nome, e-mail, CPF/CNPJ, telefone WhatsApp e senha, ***para*** possuir uma conta de acesso unificada e segura que me permita comprar obras ou solicitar perfis avançados no sistema.
>
> Validação INVEST: Independente de catálogo ou pagamento; Valiosa (base civil e cadastral da plataforma); Estimável; Pequena; Testável via BDD e testes de integração.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Cadastro de usuário com dados válidos
Dado que o visitante acessa a tela de cadastro
Quando preenche nome completo, e-mail não existente, CPF/CNPJ válido e senha forte (>= 8 caracteres, letra maiúscula, número e símbolo)
E clica em "Criar Conta"
Então a conta deve ser criada com status ativo no banco
E o papel inicial "COMPRADOR" deve ser atribuído
E o sistema deve retornar HTTP 201 Created com redirecionamento à vitrine autenticada

Cenário 2: Tentativa de cadastro com dados duplicados
Dado que o visitante informa um e-mail ou CPF/CNPJ já cadastrado no sistema
Quando tenta submeter o formulário
Então o sistema deve bloquear a operação com HTTP 409 Conflict
E exibir a mensagem: "Este e-mail ou CPF/CNPJ já está associado a uma conta ativa"

Cenário 3: Bloqueio temporário por força bruta no login (RNF-04)
Dado que um usuário erra a senha por 5 vezes consecutivas para a mesma conta
Quando tentar a 6ª submissão de senha incorreta
Então o sistema deve bloquear novas tentativas por 15 minutos e retornar HTTP 429 Too Many Requests
```

**Tarefas SMART de Engenharia:**

- [ ] **T-CAD-01 · Banco de Dados:** Criação das tabelas de usuários e papéis de acesso (3h) · **DoD:** Tabelas `usuarios` e `usuarios_papeis` criadas no PostgreSQL com tipos de perfil, chaves primárias UUID e restrições de unicidade em e-mail e CPF/CNPJ.
- [ ] **T-CAD-02 · Backend:** Endpoint de cadastro de novos usuários com validação (4h) · **DoD:** Rota `POST /auth/register` validando campos obrigatórios, gerando hash seguro de senha (Argon2id ou bcrypt) e atribuindo o papel inicial de comprador.
- [ ] **T-CAD-03 · Backend:** Endpoint de login com autenticação JWT e controle de tentativas (4h) · **DoD:** Rota `POST /auth/login` validando credenciais, emitindo token JWT de sessão e bloqueando requisições após 5 tentativas consecutivas com senha errada.
- [ ] **T-CAD-04 · Frontend:** Telas de login e cadastro com validação de formulário (5h) · **DoD:** Telas responsivas com máscaras em tempo real para CPF e telefone, validação de campos obrigatórios e feedback de erro claro ao usuário.

---

### [Ordem 02] HU-03 · Especialização de Artesão Titular e Blindagem de Curadoria

- **Épico:** Épico 1: Identidade, Acesso e Governança de Perfis
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** artesão titular, ***quero*** registrar minha biografia cultural, cadastrar minha Chave Pix e gerenciar os vínculos de curadores operacionais, ***para*** vender minhas obras, receber repasses financeiros diretamente e delegar a administração do catálogo sem expor meus dados bancários.
>
> Validação INVEST: Independente da publicação prévia de peças; Valiosa (governança do mestre titular como único beneficiário financeiro); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Habilitação de artesão com chave Pix válida
Dado que estou autenticado como usuário comum
Quando preencho minha biografia cultural e uma Chave Pix válida no formato BACEN (CPF, e-mail, celular ou aleatória)
E submeto a habilitação
Então o registro de artesão titular deve ser criado no banco
E o papel "ARTESAO" deve ser associado ao meu perfil

Cenário 2: Blindagem de acesso financeiro por Curador (Invariante 5.5)
Dado que estou autenticado com o papel exclusivo de "CURADOR"
Quando tento disparar uma requisição PATCH para alterar a chave Pix do ateliê
Então o sistema deve bloquear imediatamente a requisição com HTTP 403 Forbidden
E gravar um registro de auditoria de segurança

Cenário 3: Vinculação de curador pelo artesão titular
Dado que sou o artesão titular do ateliê
Quando informo o e-mail de outro usuário ativo na plataforma para atuar como curador
Então o vínculo associativo deve ser criado em "atelies_curadores"
E o usuário indicado passa a ter permissão de gerenciar catálogo e etiquetas
```

**Tarefas SMART de Engenharia:**

- [ ] **T-ART-01 · Banco de Dados:** Criação da tabela de artesãos e vínculo com curadores (3h) · **DoD:** Tabelas `artesaos` e `atelies_curadores` criadas com chave estrangeira e restrição de integridade referencial.
- [ ] **T-ART-02 · Backend:** Endpoint de cadastro de perfil de artesão e chave Pix (4h) · **DoD:** Rota para registrar biografia cultural e chave Pix do titular, aplicando criptografia no armazenamento para proteção dos dados bancários.
- [ ] **T-ART-03 · Backend:** Controle de acesso impedindo curadores de acessar dados bancários (4h) · **DoD:** Middleware de autorização que bloqueia usuários curadores com erro 403 caso tentem visualizar ou alterar a chave Pix do ateliê.
- [ ] **T-ART-04 · Frontend:** Painel do ateliê com gestão de equipe de curadores e proteção de dados (4h) · **DoD:** Interface permitindo convidar curadores por e-mail e ocultando completamente a seção bancária para perfis de Curador.

---

### [Ordem 03] HU-04 · Parametrização do Ateliê e Endereço Físico de Origem

- **Épico:** Épico 2: Gestão do Ateliê e Curadoria Delegada
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** artesão titular, ***quero*** cadastrar o nome comercial, o polo cultural de procedência e o endereço completo de expedição do meu ateliê, ***para*** que minha unidade produtiva seja identificada na plataforma e o cálculo de frete multi-origem utilize meu CEP real de saída de mercadorias.
>
> Validação INVEST: Independente de produtos cadastrados; Valiosa (ponto de saída obrigatório para cálculo de frete); Estimável; Pequena; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Cadastro atômico de ateliê e endereço de expedição
Dado que estou autenticado como artesão titular sem ateliê cadastrado
Quando submeto nome comercial, polo homologado (ex: "Tracunhaém") e endereço com CEP, número e logradouro
Então o registro de "atelies" e o registro de "enderecos" devem ser persistidos em uma única transação atômica
E a relação 1:1 estrita deve ser estabelecida

Cenário 2: Autopreenchimento por CEP
Dado que estou no formulário de endereço do ateliê
Quando digito um CEP válido de Pernambuco (8 dígitos) e saio do campo
Então os campos de logradouro, bairro, cidade e UF devem ser preenchidos automaticamente em menos de 1 segundo

Cenário 3: Restrição de unicidade de ateliê no MVP
Dado que já possuo um ateliê ativo vinculado ao meu cadastro
Quando tento submeter novo formulário de criação de ateliê
Então o sistema deve rejeitar a operação com HTTP 422 Unprocessable Entity
```

**Tarefas SMART de Engenharia:**

- [ ] **T-ATE-01 · Banco de Dados:** Criação das tabelas de ateliês e endereços de origem (3h) · **DoD:** Tabelas `atelies` e `enderecos` criadas no PostgreSQL garantindo exatamente 1 endereço de expedição vinculado a cada ateliê.
- [ ] **T-ATE-02 · Backend:** Endpoint de cadastro do ateliê com validação de endereço (4h) · **DoD:** Rota `POST /atelies` salvando ateliê e endereço em transação única com validação do polo cultural informado.
- [ ] **T-ATE-03 · Frontend:** Formulário de cadastro do ateliê com busca automática por CEP (4h) · **DoD:** Tela com busca automática via CEP preenchendo rua, bairro e cidade, e dropdown de polos culturais pernambucanos.

---

### [Ordem 04] HU-05 · Catalogação de Peças com Cubagem Obrigatória e Fotos

- **Épico:** Épico 3: Acervo Cultural, Cubagem Física e Lotes Limitados
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** artesão ou curador autorizado, ***quero*** catalogar uma peça informando título, descrição, tipologia, preço, peso embalado, dimensões físicas, indicador de fragilidade e fotos, ***para*** disponibilizar a obra na vitrine pública garantindo parâmetros exatos para o cálculo automatizado do frete e do seguro de carga.
>
> Validação INVEST: Independente de checkout; Valiosa (Invariante Central 2 do domínio); Estimável; Testável com validações físicas.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Publicação com cubagem e peso válidos
Dado que preencho título, tipologia homologada, preço > 0, peso >= 50g, dimensões > 0 e envio 2 fotos
Quando clico em "Publicar Peça"
Então a peça deve ser gravada com status "DISPONIVEL" E as URLs das fotos otimizadas devem ser associadas

Cenário 2: Rejeição por violação de peso mínimo (Invariante 2)
Dado que tento cadastrar uma peça informando peso de 30 gramas
Quando tento submeter a publicação
Então o sistema deve rejeitar a operação com HTTP 422 Unprocessable Entity
E destacar: "O peso mínimo embalado para cotação de frete é 50g"

Cenário 3: Sinalização de fragilidade para seguro
Dado que a peça cadastrada possui a opção "Peça Frágil (Cerâmica/Barro)" marcada como verdadeira
Quando a peça é publicada
Então ela deve ser gravada com is_fragil = true para fins de seguro de carga obrigatório
```

**Tarefas SMART de Engenharia:**

- [ ] **T-PEC-01 · Banco de Dados:** Criação das tabelas de peças e fotos com validações físicas (3h) · **DoD:** Tabela `pecas` com restrição de peso mínimo (50g), dimensões positivas e tabela `fotos_peca` associada.
- [ ] **T-PEC-02 · Backend:** Endpoints de cadastro e edição de peças com validação de cubagem (4h) · **DoD:** Rotas de CRUD de peças bloqueando cadastro sem peso, dimensões ou flag de fragilidade.
- [ ] **T-PEC-03 · Backend:** Serviço de processamento e upload de fotos da peça (4h) · **DoD:** Módulo que recebe fotos da peça, converte para formato otimizado na web e armazena em disco ou nuvem com URLs salvas no banco.
- [ ] **T-PEC-04 · Frontend:** Formulário de cadastro de peças com galeria e foto de capa (5h) · **DoD:** Tela com campos de medidas, peso, descrição, upload de fotos com visualização prévia e seleção da foto principal.

---

### [Ordem 05] HU-06 · Gestão de Lotes Limitados e Controle de Estoque

- **Épico:** Épico 3: Acervo Cultural, Cubagem Física e Lotes Limitados
- **Prioridade:** SHOULD HAVE

**História de Usuário (INVEST):**

> ***Como*** artesão ou curador, ***quero*** cadastrar peças indicando uma quantidade física de estoque maior que 1 (Lote Limitado), ***para*** vender réplicas autorizadas da mesma tipologia e dimensões sem ter o trabalho de recadastrar o item individualmente a cada venda.
>
> Validação INVEST: Independente de peças únicas; Valiosa (atende à produção artesanal em série); Estimável; Pequena; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Cadastro de lote com estoque múltiplo
Dado que estou cadastrando uma peça em lote
Quando defino a quantidade em estoque como 10 unidades
Então a peça deve ser salva com quantidade_estoque = 10
E a vitrine deve exibir a contagem disponível

Cenário 2: Decremento atômico de estoque no início da compra
Dado um lote com quantidade_estoque = 5
Quando um comprador inicia o checkout reservando 2 unidades
Então o saldo de estoque disponível deve ser reduzido atomicamente para 3

Cenário 3: Prevenção de saldo negativo (Overselling)
Dado um lote com quantidade_estoque = 1
Quando dois compradores tentam reservar simultaneamente 1 unidade cada
Então exatamente 1 transação deve obter sucesso e a outra deve ser rejeitada com HTTP 409 Conflict
E o saldo em estoque nunca deve ficar negativo
```

**Tarefas SMART de Engenharia:**

- [ ] **T-LOT-01 · Banco de Dados:** Adição de controle de quantidade em estoque (2h) · **DoD:** Coluna `quantidade_estoque` na tabela `pecas` com restrição no banco impedindo valores menores que zero.
- [ ] **T-LOT-02 · Backend:** Atualização de estoque e prevenção de venda sem saldo (4h) · **DoD:** Lógica transacional que debita o estoque na compra e devolve se a reserva expirar, sem permitir saldo negativo.
- [ ] **T-LOT-03 · Frontend:** Seletor de quantidade no produto e aviso de estoque baixo (3h) · **DoD:** Interface permitindo escolher a quantidade desejada e exibindo alerta de "Restam poucas unidades" para saldo pequeno.

---

### [Ordem 06] HU-07 · Vitrine Cultural com Filtros Dinâmicos e Busca Textual (FTS)

- **Épico:** Épico 4: Vitrine Regional, Busca e Cotação Logística
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** comprador ou visitante, ***quero*** filtrar o acervo por polo geográfico e tipologia, realizar buscas textuais pelo nome ou descrição da peça e simular o frete na página do item, ***para*** encontrar obras de meu interesse cultural e conhecer previamente o custo e prazo de envio até minha residência.
>
> Validação INVEST: Independente de autenticação; Valiosa (porta de entrada para conversão); Estimável; Testável com filtros de catálogo.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Filtragem combinada por polo e tipologia
Dado que acesso a vitrine pública
Quando seleciono o polo "Tracunhaém" e a tipologia "Barro/Cerâmica"
Então apenas peças disponíveis que atendam a ambos os critérios devem ser exibidas
E a resposta da listagem deve ocorrer em tempo inferior a 400ms

Cenário 2: Busca textual por termos culturais (FTS)
Dado que digito "maracatu barro" no campo de busca
Quando a pesquisa é executada
Então as peças correspondentes devem ser retornadas ordenadas por relevância textual via índice GIN

Cenário 3: Simulação de frete na página de detalhes
Dado que informo um CEP de entrega válido na página da peça
Quando clico em "Calcular Frete"
Então o sistema deve consultar a API logística com base no CEP do ateliê de origem e cubagem da peça
E exibir o valor e o prazo estimado em menos de 1.800ms
```

**Tarefas SMART de Engenharia:**

- [ ] **T-VIT-01 · Banco de Dados:** Otimização de busca no catálogo e filtros (3h) · **DoD:** Configuração de busca textual em título e descrição da peça e criação de índices para filtros rápidos por polo e tipologia.
- [ ] **T-VIT-02 · Backend:** Endpoint de listagem do catálogo com filtros e busca (4h) · **DoD:** Rota `GET /catalogo` retornando peças ativas com paginação, busca textual e filtros de polo e tipologia.
- [ ] **T-VIT-03 · Backend:** Serviço de cotação e simulação de frete na página do produto (4h) · **DoD:** Endpoint de cálculo de frete consumindo o CEP de origem do ateliê e as medidas da peça até o CEP de destino.
- [ ] **T-VIT-04 · Frontend:** Vitrine com barra de busca, filtros regionais e simulador de frete (5h) · **DoD:** Grid de produtos responsivo com barra de pesquisa, caixas de seleção de polos e calculadora de frete no detalhe da peça.

---

### [Ordem 07] HU-08 · Perfil Biográfico e Portfólio do Mestre Artesão

- **Épico:** Épico 4: Vitrine Regional, Busca e Cotação Logística
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** comprador interessado na procedência cultural, ***quero*** acessar a página dedicada de um Mestre Artesão específico para ler sua trajetória histórica e visualizar todas as suas obras catalogadas, ***para*** compreender o valor autoral do trabalho e adquirir peças diretamente de sua tradição artística.
>
> Validação INVEST: Independente de fluxos de checkout; Valiosa (diferencial autoral do marketplace); Estimável; Pequena; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Exibição de storytelling e acervo do artesão
Dado que clico no nome do artesão em qualquer card da vitrine
Quando a página "/mestre/:id" é carregada
Então devo visualizar sua fotografia, polo regional, biografia cultural completa
E a grade de suas peças disponíveis para venda

Cenário 2: Isolamento de catálogo por produtor
Dado que o Mestre A possui 5 peças e o Mestre B possui 3
Quando acesso a página do Mestre A
Então nenhuma peça do Mestre B deve constar na listagem retornada

Cenário 3: Otimização de SEO cultural
Dado que a página do mestre é indexada por motores de busca
Quando o HTML é renderizado
Então as meta tags Open Graph (Title, Description) devem conter o nome do mestre e o resumo de sua história
```

**Tarefas SMART de Engenharia:**

- [ ] **T-MES-01 · Banco de Dados:** Estruturação da consulta de acervo por artesão (1h) · **DoD:** Consulta estruturada e indexada para listar todas as peças ativas de um artesão titular com rapidez.
- [ ] **T-MES-02 · Backend:** Endpoint com dados biográficos e peças do mestre (3h) · **DoD:** Rota `GET /artesaos/:id/portfolio` retornando histórico cultural e catálogo ativo do mestre sem expor dados bancários.
- [ ] **T-MES-03 · Frontend:** Página dedicada ao Mestre com storytelling cultural (4h) · **DoD:** Página com foto do artesão, biografia, polo de atuação e galeria exclusiva das obras de sua autoria.

---

### [Ordem 08] HU-09 · Carrinho Fracionado e Reserva Concorrente de Peça Única (Invariante 1)

- **Épico:** Épico 5: Carrinho Multi-Origem e Reserva Concorrente de Peças
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** comprador, ***quero*** consolidar itens de múltiplos ateliês no carrinho e ter peças únicas reservadas atomicamente por 15 minutos ao prosseguir para o pagamento, ***para*** que nenhum outro usuário adquira a mesma peça exclusiva enquanto concluo a transação e eu visualize com clareza os fretes fracionados por origem.
>
> Validação INVEST: Independente de gateways de pagamento; Valiosa (Invariante 1 contra duplicidade de venda); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Agrupamento visual de carrinho multi-origem
Dado que adiciono itens do Ateliê A (Tracunhaém) e do Ateliê B (Bezerros)
Quando visualizo meu carrinho de compras
Então os itens devem ser exibidos em 2 blocos separados por ateliê
E cada bloco deve apresentar seu frete individualizado e o total consolidado da compra

Cenário 2: Colisão concorrente na reserva de peça única
Dado que uma peça única possui estoque = 1
Quando 50 compradores clicam simultaneamente em avançar para o pagamento
Então exatamente 1 comprador deve obter a reserva com HTTP 201 Created
E exatamente 49 compradores devem receber notificação de item reservado com HTTP 409 Conflict
E nenhuma venda duplicada física deve ocorrer

Cenário 3: Expiração automática da reserva aos 15 minutos
Dado que uma peça foi reservada com sucesso
Quando se decorrem 15 minutos sem a confirmação do pagamento
Então a rotina agendada deve cancelar a reserva expirada
E o status da peça deve retornar imediatamente para "DISPONIVEL" no catálogo
```

**Tarefas SMART de Engenharia:**

- [ ] **T-RES-01 · Banco de Dados:** Criação da tabela de reservas com trava de peça única (2h) · **DoD:** Tabela `reservas` com regra de unicidade garantindo que uma peça única só tenha uma reserva ativa por vez no banco.
- [ ] **T-RES-02 · Backend:** Endpoint de criação de reserva temporária de 15 minutos (4h) · **DoD:** Rota para bloquear a peça no carrinho com expiração gravada em 15 minutos e tratamento de conflito caso outro usuário tente reservar.
- [ ] **T-RES-03 · Backend:** Rotina automática de cancelamento de reservas expiradas (4h) · **DoD:** Processo periódico em background que cancela reservas que ultrapassaram 15 minutos e devolve os itens para status "DISPONIVEL".
- [ ] **T-RES-04 · Frontend:** Tela do carrinho com divisão por ateliê e cronômetro de 15 minutos (5h) · **DoD:** Carrinho agrupando produtos por ateliê de origem e cronômetro regressivo com aviso visual de tempo esgotado.

---

### [Ordem 09] HU-10 · Checkout Unificado e Captura Centralizada via Pix e Cartão

- **Épico:** Épico 6: Checkout Unificado e Pagamento Consolidado
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** comprador, ***quero*** pagar o valor consolidado de toda a compra (peças e fretes de todas as origens) em uma única transação via Pix ou Cartão de Crédito, ***para*** não ser obrigado a efetuar múltiplos pagamentos fragmentados para cada ateliê remetente.
>
> Validação INVEST: Independente da logística posterior; Valiosa (elimina atrito financeiro de múltiplos checkouts); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Geração de Pix casado com o tempo de reserva
Dado que escolho pagar o pedido via Pix
Quando confirmo a finalização da compra
Então o sistema deve gerar um QR Code dinâmico com expiração exatamente casada com o tempo restante da reserva ativa
E apresentar o código "Copia e Cola"

Cenário 2: Ingestão de pagamento com chave de idempotência (RNF-06)
Dado que o gateway financeiro notifica a aprovação do pagamento via webhook
Quando o webhook é recebido repetidas vezes pela aplicação
Então o pedido deve ser marcado como "APROVADO" apenas na primeira execução
E as requisições duplicadas devem ser ignoradas sem duplicar subpedidos ou eventos financeiros

Cenário 3: Cancelamento de reserva em caso de recusa
Dado que a transação via cartão é recusada pela operadora
Quando a notificação de recusa é processada
Então o pedido deve assumir status "RECUSADO" E as reservas devem ser canceladas imediatamente, devolvendo as peças ao catálogo
```

**Tarefas SMART de Engenharia:**

- [ ] **T-PAG-01 · Banco de Dados:** Criação da tabela de pedidos consolidados e pagamentos (2h) · **DoD:** Tabelas de pedidos com campos de totais, fretes consolidados e restrições garantindo a soma exata dos valores.
- [ ] **T-PAG-02 · Backend:** Endpoint de checkout com geração de Pix e cartão (5h) · **DoD:** Rota de pagamento gerando QR Code Pix dinâmico com tempo casado à reserva e integração com cartão de crédito.
- [ ] **T-PAG-03 · Backend:** Webhook de confirmação de pagamento com proteção contra duplicidade (4h) · **DoD:** Tratamento do retorno do gateway financeiro com controle de chave única (idempotência) para não duplicar pedidos.
- [ ] **T-PAG-04 · Frontend:** Tela de pagamento com Pix Copia-e-Cola e confirmação em tempo real (4h) · **DoD:** Interface de pagamento com exibição de QR Code Pix, botão de cópia rápida e atualização automática pós-aprovação.

---

### [Ordem 10] HU-11 · Livro de Endereços do Comprador (Address Book)

- **Épico:** Épico 6: Checkout Unificado e Pagamento Consolidado
- **Prioridade:** SHOULD HAVE

**História de Usuário (INVEST):**

> ***Como*** comprador frequente, ***quero*** cadastrar e salvar múltiplos endereços de entrega em minha conta, ***para*** selecioná-los rapidamente no checkout com recálculo automático de frete sem a necessidade de redigitar dados a cada compra.
>
> Validação INVEST: Independente de gateways de pagamento; Valiosa (agilidade no fechamento de compra); Estimável; Pequena; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Troca de endereço no checkout com recálculo
Dado que possuo mais de um endereço cadastrado
Quando seleciono um endereço alternativo na tela de checkout
Então os fretes de todos os ateliês do pedido devem ser recalculados automaticamente antes de liberar o pagamento

Cenário 2: Preservação histórica de endereços em pedidos
Dado que utilizei um endereço em um pedido consolidado já finalizado
Quando apago esse endereço da minha lista cadastral
Então o endereço associado ao pedido histórico deve permanecer íntegro e inalterado no banco

Cenário 3: Limite máximo de endereços cadastrados
Dado que já possuo 5 endereços salvos
Quando tento cadastrar um sexto endereço
Então o sistema deve solicitar a remoção ou edição de um endereço existente
```

**Tarefas SMART de Engenharia:**

- [ ] **T-END-01 · Banco de Dados:** Tabela de endereços de entrega do usuário (2h) · **DoD:** Relacionamento de múltiplos endereços por comprador, preservando os dados históricos vinculados a pedidos já concluídos.
- [ ] **T-END-02 · Backend:** Endpoints para gerenciar endereços e recalcular frete (3h) · **DoD:** Rotas de inclusão, listagem e remoção de endereços do comprador com recálculo de frete de cada ateliê ao trocar de local.
- [ ] **T-END-03 · Frontend:** Seleção de endereços de entrega salvos no checkout (3h) · **DoD:** Interface em cartões permitindo ao comprador escolher o endereço com um clique e aguardar o recálculo do frete.

---

### [Ordem 11] HU-12 · Desmembramento em Subpedidos e Emissão de Etiquetas com Seguro

- **Épico:** Épico 7: Orquestração de Subpedidos e Logística Regional (SLA 7 Dias)
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** sistema e ateliê produtor, ***quero*** que cada pedido consolidado aprovado seja desmembrado em subpedidos isolados por ateliê com etiquetas de envio e seguro de carga pré-pagos, ***para*** que cada artesão prepare e despache exclusivamente suas peças com garantia de cobertura financeira contra sinistros de transporte.
>
> Validação INVEST: Independente de repasses financeiros; Valiosa (base da operação logística descentralizada); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Desmembramento exato por ateliê
Dado um pedido consolidado aprovado com peças de 3 ateliês distintos
Quando o evento "PagamentoAprovado" é processado
Então devem ser gerados exatamente 3 subpedidos independentes no banco de dados
E cada subpedido deve conter exclusivamente os itens e frete do respectivo ateliê

Cenário 2: Snapshot financeiro imutável no subpedido
Dado o desmembramento de itens no subpedido
Quando os registros são salvos
Então o preco_unitario_historico e a comissao_plataforma_historica devem ser congelados com o valor do instante da compra

Cenário 3: Guia obrigatório de embalagem para peças frágeis
Dado um subpedido contendo peças de cerâmica com is_fragil = true
Quando o artesão clica em "Emitir Etiqueta de Envio"
Então o modal "Guia de Embalagem Segura para Peças Frágeis" deve ser exibido obrigatoriamente antes de liberar o PDF
```

**Tarefas SMART de Engenharia:**

- [ ] **T-SUB-01 · Banco de Dados:** Criação das tabelas de subpedidos e itens do subpedido (3h) · **DoD:** Tabelas criadas com vínculo ao pedido principal e ateliê, congelando o preço histórico pago pela peça.
- [ ] **T-SUB-02 · Backend:** Lógica de desmembramento automático do pedido por ateliê (4h) · **DoD:** Rotina assíncrona que divide o pedido pago em múltiplos subpedidos individuais por ateliê produtor.
- [ ] **T-SUB-03 · Backend:** Integração para emissão de etiquetas com seguro de carga (4h) · **DoD:** Chamada à API do operador de frete para gerar a etiqueta oficial com declaração de valor para seguro rodoviário.
- [ ] **T-SUB-04 · Frontend:** Painel do ateliê com remessas e guia de embalagem de cerâmica (4h) · **DoD:** Interface do ateliê exibindo as remessas a enviar e bloqueando o download da etiqueta até o artesão confirmar a leitura do guia de peças frágeis.

---

### [Ordem 12] HU-13 · Rastreamento, SLA de 7 Dias Úteis e Cancelamento por Atraso

- **Épico:** Épico 7: Orquestração de Subpedidos e Logística Regional (SLA 7 Dias)
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** comprador e administração da plataforma, ***quero*** acompanhar o código de rastreamento do meu subpedido e contar com um prazo limite de 7 dias úteis para postagem pelo ateliê, ***para*** monitorar o trânsito da entrega e ter a garantia de cancelamento com estorno integral caso o artesão descumpra o prazo de envio.
>
> Validação INVEST: Independente de outros subpedidos do mesmo cliente; Valiosa (protege o comprador contra atrasos crônicos); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Postagem realizada dentro do prazo de 7 dias úteis
Dado um subpedido com status "AGUARDANDO_POSTAGEM"
Quando o ateliê informa um código de rastreio válido dentro dos 7 dias úteis
Então o status deve transitar para "POSTADO"
E a data_postagem deve ser registrada, notificando o comprador

Cenário 2: Alertas preventivos nos dias 3 e 5 úteis
Dado um subpedido sem código de rastreio registrado
Quando o cron job diário executa no 3º e no 5º dia útil após o pagamento
Então alertas preventivos devem ser enviados automaticamente ao artesão e curador do ateliê

Cenário 3: Cancelamento com estorno de 100% por violação de SLA
Dado que se esgotaram os 7 dias úteis sem registro de postagem pelo ateliê
Quando o comprador clica em "Cancelar por Atraso"
Então o subpedido deve mudar para "CANCELADO_POR_ATRASO"
E o comprador deve receber 100% de estorno do valor do subpedido (peça + frete) no gateway
```

**Tarefas SMART de Engenharia:**

- [ ] **T-SLA-01 · Banco de Dados:** Estrutura para controle de datas de postagem e SLA (2h) · **DoD:** Campos de data limite de postagem, código de rastreamento e status logístico na tabela de subpedidos.
- [ ] **T-SLA-02 · Backend:** Registro de código de rastreio e cálculo do prazo de 7 dias úteis (4h) · **DoD:** Rota para o ateliê registrar o código de rastreio e cálculo automático do SLA pulando sábados e domingos.
- [ ] **T-SLA-03 · Backend:** Rotina de alertas de postagem e cancelamento automático por atraso (4h) · **DoD:** Disparo de lembretes automáticos no 3º e 5º dia útil e liberação de cancelamento com estorno caso ultrapasse 7 dias úteis sem postar.
- [ ] **T-SLA-04 · Frontend:** Acompanhamento de envio com linha do tempo e botão de cancelamento (4h) · **DoD:** Visualização das etapas da encomenda e botão de cancelamento habilitado exclusivamente em caso de estouro do prazo de envio.

---

### [Ordem 13] HU-14 · Custódia Pós-Entrega (D + 7) e Liquidação Automatizada via Pix

- **Épico:** Épico 8: Custódia Financeira Desacoplada e Repasses Automatizados via Pix
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** artesão titular e administração da plataforma, ***quero*** que o valor líquido das peças fique retido em custódia preventiva por 7 dias corridos após a confirmação de entrega e seja transferido automaticamente via Pix, ***para*** garantir o cumprimento do direito de arrependimento legal do comprador e remunerar o mestre artesão diretamente sem burocracias de subcontas bancárias.
>
> Validação INVEST: Independente de vitrine e catálogo; Valiosa (inclusão financeira do artesão); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Retenção em custódia com snapshot da Chave Pix
Dado um subpedido gerado a partir de pagamento aprovado
Quando o registro em "repasses_pix" é criado
Então o status deve ser "RETIDO_EM_CUSTODIA"
E a chave Pix atual do artesão titular deve ser copiada imutavelmente para a ordem de repasse

Cenário 2: Início da contagem da janela D+7 após entrega física
Dado que o webhook da transportadora confirma a entrega física do pacote ao comprador
Quando o evento é processado
Então a data_previsao_liberacao deve ser calculada como data_entrega + 7 dias corridos

Cenário 3: Liquidação automatizada via Pix sem disputas
Dado que a data atual atinge a data_previsao_liberacao e inexistem disputas abertas
Quando o job financeiro diário executa
Então a transferência Pix do valor líquido deve ser executada com Idempotency-Key
E o status deve transitar para "LIQUIDADO_PIX", gravando o código End-to-End do BACEN

Cenário 4: Congelamento compulsório por abertura de disputa
Dado um repasse retido em custódia
Quando o comprador abre uma disputa de avaria ou arrependimento dentro dos 7 dias pós-entrega
Então o repasse deve transitar imediatamente para "CONGELADO_POR_DISPUTA", bloqueando o Pix
```

**Tarefas SMART de Engenharia:**

- [ ] **T-CUS-01 · Banco de Dados:** Criação da tabela de repasses com cálculo de comissão (3h) · **DoD:** Tabela `repasses_pix` com valor bruto da peça, taxa retida pela plataforma e valor líquido devido ao artesão.
- [ ] **T-CUS-02 · Backend:** Controle da janela de custódia de 7 dias após a entrega (4h) · **DoD:** Ingestão da notificação de entrega física da transportadora e agendamento da data de liberação do repasse para 7 dias corridos depois.
- [ ] **T-CUS-03 · Backend:** Rotina automática de transferência Pix para a chave do artesão (4h) · **DoD:** Processo diário que executa transferências Pix diretas para as chaves cadastradas dos repasses que venceram os 7 dias sem disputa.
- [ ] **T-CUS-04 · Frontend:** Painel financeiro com extrato de repasses para o artesão (4h) · **DoD:** Tela no painel do artesão exibindo valores em custódia, valores já transferidos e bloqueando o acesso de usuários curadores.

---

### [Ordem 14] HU-15 · Registro de Avaria em até 48h e Arbitragem de Sinistro

- **Épico:** Épico 9: Gestão de Avarias em Transporte (Sinistros) e Arrependimento Legal (CDC)
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** comprador prejudicado e administração da plataforma, ***quero*** registrar queixas de peças frágeis quebradas durante o transporte anexando fotos em até 48 horas após a entrega e contar com arbitragem administrativa do laudo, ***para*** receber estorno integral coberto pelo seguro de carga da transportadora e assegurar que o artesão que embalou corretamente receba o pagamento de sua obra.
>
> Validação INVEST: Independente de outros subpedidos; Valiosa (garante a venda segura de cerâmicas frágeis); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Abertura de sinistro no prazo legal de 48 horas
Dado que o subpedido foi marcado como "ENTREGUE" há menos de 48 horas corridas
Quando o comprador anexa fotos da embalagem externa, etiqueta e peça danificada
Então o subpedido deve mudar para "EM_DISPUTA"
E o repasse Pix correspondente deve ser congelado no mesmo instante

Cenário 2: Bloqueio de queixa após 48 horas da entrega
Dado que se passaram mais de 48 horas corridas desde a confirmação de entrega
Quando o comprador tenta abrir reporte de avaria física de frete
Então o sistema deve bloquear o formulário com a mensagem: "Prazo de 48h para sinistro de transporte expirado"

Cenário 3: Resolução de sinistro favorável ao comprador e artesão
Dado laudo administrativo comprovando dano por impacto da transportadora com embalagem adequada
Quando o administrador conclui a arbitragem
Então o comprador recebe 100% de reembolso no gateway
E o repasse ao artesão é descongelado para liquidação normal coberta pelo seguro
```

**Tarefas SMART de Engenharia:**

- [ ] **T-DIS-01 · Banco de Dados:** Criação da tabela de disputas e registro de avarias (2h) · **DoD:** Tabela `disputas_avaria` vinculada ao subpedido com campos para descrição da queixa e URLs das fotos de evidência.
- [ ] **T-DIS-02 · Backend:** Endpoint para o comprador registrar avaria em até 48 horas (4h) · **DoD:** Rota que recebe as fotos da peça quebrada, valida o prazo de 48 horas após a entrega e congela o repasse Pix do artesão.
- [ ] **T-DIS-03 · Backend:** Endpoint administrativo para julgamento do sinistro e estorno (4h) · **DoD:** Rota para o administrador registrar o parecer final, acionando o reembolso do cliente no gateway e o seguro de carga.
- [ ] **T-DIS-04 · Frontend:** Telas de reporte de avaria e painel administrativo de análise (4h) · **DoD:** Formulário de envio de fotos pelo comprador e tela administrativa com visualizador de imagens para avaliação do laudo.

---

### [Ordem 15] HU-16 · Exercício do Direito de Arrependimento em 7 Dias (CDC Art. 49)

- **Épico:** Épico 9: Gestão de Avarias em Transporte (Sinistros) e Arrependimento Legal (CDC)
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** comprador, ***quero*** solicitar a devolução de uma peça por desistência imotivada em até 7 dias corridos após o recebimento, ***para*** exercer meu direito inquestionável de arrependimento assegurado pelo Código de Defesa do Consumidor sem custos de logística reversa.
>
> Validação INVEST: Independente de comprovação de defeito; Valiosa (conformidade legal obrigatória do CDC); Estimável; Pequena; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Solicitação tempestiva com código reverso gratuito
Dado um subpedido no status "ENTREGUE" há 7 dias corridos ou menos
Quando o comprador clica em "Devolver por Desistência"
Então o sistema deve aprovar a solicitação automaticamente
E gerar código de postagem reversa pré-paga nos Correios/transportadora
E congelar o repasse financeiro do artesão

Cenário 2: Rejeição por intempestividade após 7 dias
Dado que se passaram 8 dias corridos desde a confirmação de entrega
Quando o comprador tenta acionar a devolução por desistência
Então o sistema deve bloquear o botão informando a expiração do prazo do Art. 49 do CDC

Cenário 3: Estorno integral pós-devolução física
Dado que o código de rastreio reverso confirma que o pacote retornou intacto ao ateliê
Quando o evento de devolução é processado
Então o comprador recebe 100% de estorno do valor pago e o repasse ao artesão é cancelado
```

**Tarefas SMART de Engenharia:**

- [ ] **T-ARR-01 · Banco de Dados:** Campos de controle de devolução no subpedido (1h) · **DoD:** Inclusão dos campos de código de postagem reversa e status de devolução na tabela de subpedidos.
- [ ] **T-ARR-02 · Backend:** Validação do prazo de 7 dias e emissão de postagem reversa (4h) · **DoD:** Rota validando o limite legal de 7 dias pós-entrega, cancelando o repasse e integrando a geração do código reverso nos Correios.
- [ ] **T-ARR-03 · Frontend:** Tela de solicitação de devolução com instruções de embalagem (3h) · **DoD:** Interface simples para o cliente solicitar a devolução e visualizar o código gratuito dos Correios com botão de cópia.

---

### [Ordem 16] HU-02 · Recuperação Segura de Senha

- **Épico:** Épico 1: Identidade, Acesso e Governança de Perfis
- **Prioridade:** SHOULD HAVE

**História de Usuário (INVEST):**

> ***Como*** usuário cadastrado que esqueceu suas credenciais, ***quero*** solicitar a redefinição de minha senha através do meu e-mail, ***para*** restabelecer o acesso à minha conta de forma autônoma e segura sem depender de atendimento manual.
>
> Validação INVEST: Independente de outros módulos; Valiosa (reduz sobrecarga de suporte); Estimável; Pequena; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Solicitação com e-mail existente
Dado que solicito recuperação informando um e-mail válido existente
Quando a requisição é submetida
Então um token criptográfico descartável com validade de 30 minutos deve ser gerado
E uma mensagem com o link de recuperação deve ser enfileirada para envio

Cenário 2: Proteção contra enumeração de contas
Dado que informo um e-mail inexistente na plataforma
Quando submeto a recuperação de senha
Então o sistema deve retornar HTTP 200 OK com mensagem genérica de sucesso
E nenhum vazamento sobre a existência do e-mail deve ocorrer

Cenário 3: Redefinição com invalidação de sessões ativas
Dado que possuo um token de recuperação válido e não expirado
Quando informo e salvo a nova senha forte
Então a nova senha deve ser persistida com hash Argon2id
E o token deve ser invalidado para novos usos, encerrando sessões ativas anteriores
```

**Tarefas SMART de Engenharia:**

- [ ] **T-REC-01 · Banco de Dados:** Tabela de tokens de recuperação de senha (2h) · **DoD:** Tabela `recuperacoes_senha` com referência ao usuário, token criptografado e data de expiração de 30 minutos.
- [ ] **T-REC-02 · Backend:** Endpoints para solicitar recuperação e cadastrar nova senha (4h) · **DoD:** Rota de solicitação gerando link descartável por e-mail e rota de redefinição gravando a nova senha com hash seguro.
- [ ] **T-REC-03 · Frontend:** Telas de solicitação e criação de nova senha (3h) · **DoD:** Formulário para digitar o e-mail cadastrado e tela com campos de nova senha com validação visual de requisitos.

---

### [Ordem 17] HU-17 · Hub de Notificações Transacionais Multicanal

- **Épico:** Épico 10: Gestão Administrativa, Notificações e Auditoria da Plataforma
- **Prioridade:** SHOULD HAVE

**História de Usuário (INVEST):**

> ***Como*** usuário da plataforma (comprador ou artesão), ***quero*** receber notificações automáticas por e-mail e WhatsApp a cada alteração de status do meu pedido e avisos sobre prazos iminentes, ***para*** me manter informado sem a necessidade de acessar o painel da plataforma constantemente.
>
> Validação INVEST: Independente da execução transacional direta; Valiosa (cumprimento de prazos de envio); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Notificação assíncrona de pagamento aprovado
Dado que o evento "PagamentoAprovado" é disparado no sistema
Quando o worker de mensageria processa a mensagem
Então o comprador deve receber o recibo consolidado por e-mail
E o ateliê deve receber aviso de nova encomenda para postagem

Cenário 2: Alerta preventivo de proximidade do 5º dia útil de SLA
Dado um subpedido que atingiu o 5º dia útil sem registro de postagem
Quando a rotina de fiscalização executa
Então o artesão titular deve receber alerta urgente por e-mail e mensagem destacando o risco de cancelamento

Cenário 3: Tolerância a falhas e retentativas exponenciais
Dado que o provedor de e-mails retorne erro transitório (HTTP 503)
Quando o envio falha
Então a mensagem deve permanecer na fila BullMQ para reprocessamento com backoff exponencial
E nenhuma transação de checkout em andamento deve ser bloqueada
```

**Tarefas SMART de Engenharia:**

- [ ] **T-NOT-01 · Banco de Dados:** Tabela de histórico e logs de notificações enviadas (2h) · **DoD:** Tabela `logs_notificacoes` registrando destinatário, canal (e-mail/WhatsApp), mensagem e data de envio.
- [ ] **T-NOT-02 · Backend:** Serviço de envio de e-mails transacionais em background (4h) · **DoD:** Módulo assíncrono para enviar e-mails de pedido aprovado e alertas de prazo de postagem sem travar o tempo de resposta da API.
- [ ] **T-NOT-03 · Frontend:** Templates de e-mails informativos sobre o pedido (3h) · **DoD:** Modelos visuais e responsivos de e-mail para confirmação de pagamento, aviso de envio e código de rastreamento.

---

### [Ordem 18] HU-18 · Painel Administrativo de Moderação, Auditoria e Fundo de Sinistros

- **Épico:** Épico 10: Gestão Administrativa, Notificações e Auditoria da Plataforma
- **Prioridade:** MUST HAVE

**História de Usuário (INVEST):**

> ***Como*** administrador da plataforma, ***quero*** moderar o acervo de peças, aprovar ou suspender ateliês e auditar métricas consolidadas de vendas, custódias retidas e ressarcimentos do fundo de sinistros, ***para*** zelar pelo alto padrão curatorial, mitigar riscos de fraudes e garantir o equilíbrio econômico do marketplace.
>
> Validação INVEST: Independente de compradores comuns; Valiosa (instrumento de governança e controle do negócio); Estimável; Testável.

**Critérios de Aceite (BDD / Gherkin):**

```gherkin
Cenário 1: Suspensão curatorial de peça irregular
Dado que o administrador identifica uma peça industrializada fora do perfil cultural de Pernambuco
Quando aciona o comando "Suspender Peça" no painel de moderação
Então a peça deve transitar imediatamente para "ARQUIVADA"
E deixar de ser exibida em qualquer listagem da vitrine pública

Cenário 2: Suspensão de ateliê por infrações operacionais
Dado que um ateliê comete descumprimentos graves e reiterados de envio
Quando o administrador suspende o cadastro do ateliê
Então todas as suas peças ativas devem ser ocultadas da vitrine
E o acesso de seus curadores ao catálogo deve ser bloqueado, preservando pedidos históricos

Cenário 3: Auditoria contábil de custódias e fundo de sinistros
Dado que o administrador acessa o painel financeiro geral da plataforma
Quando a visualização consolida
Então devem ser exibidos os totais acumulados de comissão própria da plataforma, saldo total em custódia (D+7) e montante utilizado em sinistros absorvidos
```

**Tarefas SMART de Engenharia:**

- [ ] **T-ADM-01 · Banco de Dados:** Estrutura de dados para relatórios e indicadores da plataforma (2h) · **DoD:** Consultas agregando faturamento total da plataforma, saldo total em custódia e valores ressarcidos em sinistros.
- [ ] **T-ADM-02 · Backend:** Endpoints administrativos para moderação e métricas financeiras (4h) · **DoD:** Rotas protegidas para o administrador suspender peças inadequadas e consultar saldos e comissões do marketplace.
- [ ] **T-ADM-03 · Frontend:** Painel com lista de moderação de peças e resumo financeiro (4h) · **DoD:** Interface administrativa com tabela para aprovar/suspender itens e cartões com totais financeiros do marketplace.

---

## 4. Rastreabilidade, Governança e Evolução Contínua

### Critérios de Definição de Pronto (DoD) e Prontidão (DoR)

| Conceito | Critérios Mínimos Obrigatórios |
|---|---|
| **Definition of Ready (DoR)** | • História de Usuário escrita no formato canônico INVEST com ator/persona explícito.<br>• Critérios de aceite formalizados em BDD / Gherkin (Dado / Quando / Então).<br>• Dependências de dados, modelos relacionais e rotas de API previamente mapeadas.<br>• Tarefas técnicas SMART decompostas com timebox individual ≤ 5h e camada (Banco de Dados, Backend, Frontend) atribuída. |
| **Definition of Done (DoD)** | • Código implementado em conformidade com a Clean Architecture (sem vazamento de regras de domínio).<br>• Testes unitários e de integração aprovados na suíte automatizada (≥ 85% de cobertura no core).<br>• Revisão de código (Pull Request) aprovada por ao menos um desenvolvedor par.<br>• Interface acessível e responsiva validada em viewports mobile (360px), tablet e desktop.<br>• Migrations de banco versionadas, com integridade referencial e reversibilidade testadas.<br>• Documentação de endpoints atualizada na especificação OpenAPI / Swagger. |

### Política de Evolução do Backlog

Conforme as diretrizes metodológicas do projeto, este backlog é um **documento vivo**. À medida que a equipe avança no desenvolvimento das camadas de persistência, nos testes de estresse de concorrência transacional (FCCPD / Invariante 1) e nas homologações de integração com os serviços de pagamento (Pix) e logística, novos requisitos poderão ser refinados, estimativas de horas recalculadas e tarefas reorganizadas. Qualquer alteração estrutural será devidamente refletida na **Modelagem Conceitual** e no **Catálogo de Requisitos** da plataforma.
