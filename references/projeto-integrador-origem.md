# Desenvolvimento Web no Projeto Integrador 2026.2

> Fonte: página do Notion "Projeto Integrador Origem" (última edição: 21/08/2026)

## Projeto Origem

> **Desafio do semestre:** Origem, marketplace da economia criativa e do artesanato de Pernambuco.
>
> A disciplina de **Desenvolvimento Web** será responsável por transformar o projeto em uma aplicação web funcional, integrando frontend e backend.

*[Imagem: Mapa do produto Origem]*

---

## Visão geral

| Item | Descrição |
| --- | --- |
| **Produto** | Aplicação web full stack para conectar artesãos e empreendedores criativos a compradores. |
| **Público** | Compradores, artesãos e administradores da plataforma. |
| **Contexto** | Economia criativa e artesanato de Pernambuco, com foco na valorização da origem, técnica e história das peças. |
| **Escopo central** | Vitrine, busca, filtros, perfil do artesão, carrinho, pedidos, avaliações, painel do artesão, painel administrativo e recomendação de produtos. |
| **Papel da disciplina** | Construir o produto executável, integrando as contribuições das demais disciplinas. |
| **Entrega 1** | Frontend responsivo com Fake API estruturada. |
| **Entrega 2** | Aplicação full stack integrada (Frontend + Backend + Documentação). |

---

## Como a disciplina participa do Projeto Integrador

Na disciplina de **Desenvolvimento Web**, a equipe deverá desenvolver a aplicação que materializa o Projeto Integrador.

A disciplina avalia principalmente a implementação técnica da solução, considerando:

- Funcionamento da aplicação.
- Organização do código.
- Separação de responsabilidades.
- Qualidade da arquitetura.
- Integração entre frontend e backend.
- Uso adequado de API.
- Integração com banco de dados.
- Autenticação.
- Integração com recomendação.
- Processamento assíncrono.
- Cache.
- Documentação.
- Deploy.

---

## Roadmap resumido

*[Imagem: Roadmap de entrega em Desenvolvimento Web]*

| Momento | Foco | Resultado esperado |
| --- | --- | --- |
| **Semanas 1 a 3** | Entendimento do domínio, setup e contratos iniciais | Repositório iniciado, stack definida, dados principais mapeados e rotas planejadas. |
| **Semanas 4 a 7** | Desenvolvimento do frontend | Telas principais, navegação, carrinho e Fake API estruturada. |
| **Semanas 8 a 9** | Avaliação 1 | Primeira versão navegável publicada. |
| **Semanas 10 a 15** | Backend, banco, integração, autenticação e módulos adicionais | Aplicação evoluindo para full stack real. |
| **Semanas 16 a 17** | Avaliação 2 | Produto final integrado, publicado e documentado. |

---

# Avaliação 1

## Frontend responsivo com Fake API estruturada

Na **Avaliação 1**, a equipe deverá entregar uma primeira versão navegável da aplicação **Origem**.

O foco será demonstrar que a equipe conseguiu transformar o domínio do projeto em uma aplicação web funcional, com telas principais, navegação, carrinho, consumo de dados e uma estrutura preparada para integração futura.

Nesta etapa, o frontend deverá estar pronto para consumir dados externos. Por isso, a equipe deverá usar uma **Fake API estruturada** e uma camada de `services` bem organizada.

A entrega da Avaliação 1 não deve ser apenas visual. **O frontend precisa estar preparado para consumir os dados reais do backend na Avaliação 2, sem necessidade de reconstruir a estrutura principal da aplicação.**

---

## Objetivo da Avaliação 1

A equipe deverá construir uma aplicação que já permita ao usuário navegar pelos principais fluxos do produto.

A entrega deverá demonstrar:

- Organização do frontend.
- Telas principais implementadas.
- Layout responsivo.
- Navegação funcional.
- Carrinho funcionando.
- Consumo de dados por Fake API estruturada e services.
- Estrutura preparada para integração com backend real na Avaliação 2.
- Deploy da aplicação.

---

## Escopo mínimo da Avaliação 1

| Área | O que deve aparecer na entrega |
| --- | --- |
| **Vitrine** | Página inicial ou listagem de produtos. |
| **Busca e filtros** | Busca por produto, técnica, região ou categoria. |
| **Produto** | Página de detalhes do produto. |
| **Artesão** | Perfil do artesão com dados básicos e produtos relacionados. |
| **Carrinho** | Adicionar, remover e visualizar itens. |
| **Pedido** | Fluxo inicial de pedido ou simulação de compra. |
| **Comprador** | Área inicial ou fluxo mínimo do comprador. |
| **Artesão** | Área inicial para catálogo, produtos ou estoque. |
| **Administração** | Estrutura inicial de painel administrativo. |
| **Dados** | Consumo por Fake API estruturada e services. |
| **Publicação** | Deploy público da aplicação. |

---

<details>
<summary>Orientação sobre Fake API</summary>

Na Avaliação 1, a **Fake API** deverá preparar o frontend para a integração real que acontecerá na Avaliação 2.

**A Fake API não deve ser entendida como dados soltos, arrays fixos dentro das telas ou informações hardcoded nos componentes.**

Ela deve simular, de forma organizada, os principais dados e recursos do sistema:

- Produtos.
- Artesãos.
- Usuários.
- Categorias.
- Técnicas.
- Regiões.
- Carrinho.
- Pedidos.
- Avaliações.
- Indicadores iniciais, quando fizer sentido.

O frontend deverá consumir esses dados por meio de uma camada de comunicação organizada, como:

- `services`
- `api`
- `hooks`
- `store`
- API routes

O objetivo é que, na Avaliação 2, a equipe consiga substituir a Fake API pelo backend real sem precisar refazer a estrutura principal do frontend.

</details>

<details>
<summary><strong>O que evitar</strong> na Avaliação 1</summary>

Evitem:

- Dados fixos diretamente em `page.tsx`.
- Arrays grandes dentro de componentes.
- Repetição dos mesmos dados em várias telas.
- Componentes dependendo diretamente de dados mockados internos.
- Lógica de consumo de dados espalhada sem organização.
- Telas bonitas, mas sem fluxo funcional.
- Projeto funcionando apenas localmente.

</details>

<details>
<summary><strong>O que priorizar</strong> na Avaliação 1</summary>

Priorizem:

- Services organizados por domínio.
- Tipos ou interfaces para os dados principais.
- Estrutura de resposta próxima da API real.
- Tratamento de loading.
- Tratamento de erro.
- Estados vazios.
- Separação entre interface, lógica e dados.
- Carrinho funcionando.
- Navegação clara entre telas.
- Deploy testado.

</details>

---

## Critérios de avaliação da Avaliação 1

| Critério | Peso | O que será observado |
| --- | --- | --- |
| Frontend responsivo e navegação | 50% | Telas principais, responsividade, navegação funcional e carrinho. |
| Fake API estruturada, e preparação para integração | 35% | Dados consumidos por camada organizada, contratos preparados, rotas iniciais, loading, erro e documentação inicial. |
| Integração e deploy | 15% | Aplicação publicada, fluxo básico testado no ambiente publicado e repositório organizado. |

<details>
<summary>Checklist da Avaliação 1</summary>

### Frontend responsivo e navegação

- [ ] As telas principais foram implementadas.
- [ ] A vitrine de produtos está funcional.
- [ ] A busca e os filtros estão presentes.
- [ ] O perfil do artesão pode ser acessado.
- [ ] O carrinho permite adicionar itens.
- [ ] O carrinho permite remover itens.
- [ ] O carrinho permite visualizar os itens selecionados.
- [ ] A navegação entre telas funciona sem erros críticos.
- [ ] O layout funciona em desktop.
- [ ] O layout funciona em mobile.

### Fake API estruturada e preparação para integração

- [ ] O frontend consome dados por uma camada organizada.
- [ ] Os dados não estão fixos diretamente nas páginas.
- [ ] Os principais recursos do sistema estão simulados ou implementados.
- [ ] Existem contratos ou rotas planejadas para a Avaliação 2.
- [ ] Há tratamento de loading.
- [ ] Há tratamento de erro.
- [ ] Há tratamento de estados vazios.
- [ ] A Fake API está organizada e com fluxo bem definido para a futura integração.

### Integração e deploy

- [ ] A aplicação está publicada em URL acessível.
- [ ] O fluxo básico foi testado no ambiente publicado.
- [ ] O repositório está organizado.
- [ ] O README explica como executar o projeto.
- [ ] O vídeo demonstrativo mostra os principais fluxos.

</details>

---

## 📤 Entregáveis da Avaliação 1

| Entregável | Obrigatório | Observação |
| --- | --- | --- |
| **Repositório GitHub** | Sim | Deve estar atualizado e organizado. Deverá indicar qual branch é a principal. |
| **Deploy** | Sim | A URL precisa estar acessível. |
| **Vídeo ou screencast** | Sim | Deve demonstrar os principais fluxos. |
| **README** | Sim | Deve conter instruções de execução. |
| **Documentação inicial da Fake API** | Sim | Pode ser README ou Markdown. |
| **Evidências de commits** | Sim | Os commits devem indicar participação de todos os integrantes. |
| **Descrição dos fluxos implementados** | Sim | Pode estar no README. |
| **Explicação da futura integração** | Sim | A equipe deve indicar como a Fake API será substituída pelo backend real. |

---

# Avaliação 2

## Aplicação full stack integrada

Na **Avaliação 2**, a equipe deverá entregar a versão final integrada da aplicação **Origem**.

O foco desta etapa não será melhorar visualmente a interface. **O objetivo é consolidar a aplicação como um produto full stack funcional.**

A aplicação deverá integrar:

- Frontend.
- Backend.
- Banco de dados.
- Autenticação.
- Recomendação de produtos.
- Processamento assíncrono.
- Cache.
- Documentação da API.
- Deploy final.

Arquitetura esperada para Web:

*[Imagem: Arquitetura esperada para Web]*

---

## Objetivo da Avaliação 2

**A equipe deverá demonstrar que a aplicação funciona de ponta a ponta.**

Isso significa que o usuário deverá conseguir:

- Navegar pelo sistema.
- Buscar produtos.
- Aplicar filtros.
- Visualizar detalhes de um produto.
- Acessar o perfil de um artesão.
- Adicionar itens ao carrinho.
- Confirmar um pedido.
- Acessar funcionalidades de acordo com seu perfil.

Além disso, a aplicação deverá demonstrar integração com os elementos desenvolvidos nas demais disciplinas, especialmente banco de dados, módulo de recomendação e processamento assíncrono.

---

## Escopo mínimo da Avaliação 2

| Área | O que deve funcionar na entrega final |
| --- | --- |
| **Vitrine** | Produtos carregados a partir do backend e banco. |
| **Busca e filtros** | Resultados corretos por produto, técnica, região ou categoria. |
| **Produto** | Detalhes carregados de forma dinâmica. |
| **Artesão** | Perfil do artesão integrado aos produtos. |
| **Carrinho** | Persistência dos itens e integração com o fluxo de pedido. |
| **Pedido** | Criação e confirmação do pedido. |
| **Autenticação** | Cadastro, login, sessão e rotas protegidas. |
| **Perfis** | Comprador, artesão e administrador, quando aplicável. |
| **Painel do artesão** | Gestão de catálogo, estoque e pedidos. |
| **Painel administrativo** | Gestão básica e indicadores. |
| **Recomendação** | Recomendação integrada à aplicação. |
| **Assíncrono** | Fila, notificação, processamento de imagem ou fluxo equivalente. |
| **Cache** | Cache em pelo menos um ponto relevante (ex: produto, lista de produtos). |
| **API** | API documentada e atualizada. |
| **Deploy** | Aplicação final publicada. |

---

<details>
<summary>Backend esperado na Avaliação 2</summary>

Na Avaliação 2, o backend deverá estar completo e integrado ao frontend.

A equipe deverá implementar uma API organizada, com separação de responsabilidades entre as camadas do sistema.

A estrutura recomendada para o backend deve conter:

- `routes`
- `controllers`
- `services`
- `repositories`
- `middlewares`
- `config`
- `utils`

A equipe deverá utilizar as stacks de referência da disciplina. A stack de referência da disciplina é:

- Node.js.
- Express.
- Prisma ORM.
- Banco de dados.
- JWT.
- Cookies ou estratégia equivalente de sessão.
- Redis ou tecnologia equivalente, quando fizer sentido.
- Filas ou processamento assíncrono, quando fizer sentido.

</details>

<details>
<summary>Autenticação e perfis</summary>

A aplicação deverá ter autenticação funcional.

A equipe deverá considerar os perfis necessários ao projeto, como:

- Comprador.
- Artesão.
- Administrador.

As funcionalidades devem respeitar o papel de cada usuário no sistema.

Exemplos:

- Comprador acessa vitrine, carrinho, pedidos e avaliações.
- Artesão gerencia catálogo, estoque e pedidos recebidos.
- Administrador acompanha indicadores e gerencia a plataforma.

</details>

<details>
<summary>Recomendação integrada</summary>

O módulo de recomendação precisa aparecer dentro da aplicação.

Ele não deve ficar isolado em notebook, script separado ou demonstração externa.

A recomendação deve ser consumida pelo backend ou frontend por meio de API ou serviço integrado.

Exemplos de recomendação possíveis:

- Produtos populares.
- Produtos por técnica.
- Produtos por região.
- Produtos semelhantes.
- Produtos relacionados ao comportamento do usuário.
- Produtos recomendados a partir de avaliações ou histórico de navegação.

</details>

<details>
<summary>Processamento assíncrono e cache</summary>

O processamento assíncrono precisa estar ligado a uma necessidade real do sistema.

Exemplos:

- Notificação de pedido criado.
- Processamento de imagem de produto.
- Atualização de estoque.
- Fila de pedidos.
- Geração de relatório.
- Atualização periódica de indicadores.

O cache também deve ser aplicado em um ponto relevante da aplicação.

Exemplos:

- Catálogo de produtos.
- Busca e filtros.
- Produtos populares.
- Indicadores do painel administrativo.
- Perfil do artesão.

</details>

---

## Critérios de avaliação da Avaliação 2

| Critério | Peso | O que será observado |
| --- | --- | --- |
| Integração full stack | 40% | Backend integrado ao banco, módulo de recomendação consumido pela aplicação, processamento assíncrono e autenticação funcional. |
| Fluxo end-to-end | 35% | Busca, filtros, carrinho, pedido e fluxo completo funcionando no ambiente implantado. |
| Qualidade, cache e documentação da API | 25% | Código organizado, cache implementado e documentação da API completa e atualizada. |

<details>
<summary>Checklist da Avaliação 2</summary>

### Integração full stack

- [ ] O backend está integrado ao banco de dados.
- [ ] O frontend consome endpoints reais.
- [ ] A autenticação está funcional.
- [ ] Existem rotas protegidas.
- [ ] O módulo de recomendação é consumido pela aplicação.
- [ ] O processamento assíncrono está funcionando.
- [ ] O cache foi implementado em ponto relevante.

### Fluxo end-to-end

- [ ] A busca retorna resultados corretos.
- [ ] Os filtros funcionam corretamente.
- [ ] O carrinho persiste os itens corretamente.
- [ ] O pedido é criado e confirmado.
- [ ] O fluxo principal funciona sem erros críticos.
- [ ] O fluxo foi testado no ambiente publicado.

### Qualidade, cache e documentação da API

- [ ] O código está organizado.
- [ ] Há separação de responsabilidades.
- [ ] Não há duplicação evidente de código.
- [ ] A API está documentada.
- [ ] O README está atualizado.
- [ ] O `.env.example` está disponível, sem credenciais reais.
- [ ] As instruções de execução local estão claras.

</details>

---

## Entregáveis da Avaliação 2

| Entregável | Obrigatório | Observação |
| --- | --- | --- |
| **Repositório GitHub final** | Sim | Deve conter frontend, backend e instruções de execução. |
| **Deploy final** | Sim | A aplicação precisa estar acessível publicamente. |
| **Vídeo ou screencast** | Sim | Deve demonstrar o fluxo completo, com o network do navegador aberto, mostrando as chamadas do backend. |
| **Documentação completa da API** | Sim | Deve estar atualizada e coerente com o backend entregue. De preferência no Swagger, ou outra ferramenta semelhante. |
| **README atualizado** | Sim | Deve explicar arquitetura, execução, tecnologias e deploy. |
| **`.env.example`** | Sim | Não deve conter credenciais reais. |
| **Evidência de banco de dados** | Sim | Demonstrar persistência real dos dados. |
| **Evidência de recomendação** | Sim | Mostrar recomendação funcionando dentro da aplicação. |
| **Evidência de assíncrono** | Sim | Mostrar fila, notificação, processamento ou fluxo equivalente. |
| **Evidência de cache** | Sim | Indicar onde foi aplicado e por quê. |

---

# Níveis de avaliação

| Nível | Percentual do peso | Interpretação |
| --- | --- | --- |
| **Excelente** | 100% | Atende todos os itens do checklist. |
| **Bom** | 75% | Atende à grande maioria dos itens, com falha pontual que não compromete o critério. |
| **Suficiente** | 50% | Atende pelo menos metade dos itens, mas apresenta lacunas relevantes. |
| **Insuficiente** | 25% | Atende menos da metade dos itens ou compromete a funcionalidade. |
| **Não entregue** | 0% | Item ausente, não funcional ou não demonstrável, não usa typescript, não usa as tecnologias referência da disciplina. |

---

# Qualidade técnica esperada

## 📁 Organização do código

A equipe deverá manter o projeto organizado, com separação clara entre responsabilidades.

A organização de pastas e arquivos será considerada na avaliação, pois facilita a manutenção, a leitura do código, a divisão de tarefas entre os integrantes e a evolução do projeto da Avaliação 1 para a Avaliação 2.

A estrutura abaixo é uma referência recomendada. A equipe poderá adaptá-la de acordo com as regras de negócios escolhida, desde que mantenha uma separação clara entre frontend, backend, documentação, serviços, tipos, regras de negócio e camadas de acesso a dados.

<details>
<summary><strong>Estrutura geral recomendada</strong></summary>

```txt
projeto-origem/
│
├── frontend/
│
├── backend/
│
├── docs/
│   ├── uso-de-ia.md
│   ├── api.md
│   └── arquitetura.md
│
├── README.md
│
└── .gitignore
```

| Pasta ou arquivo | Finalidade |
| --- | --- |
| `frontend/` | Código da aplicação web usada pelo comprador, artesão e administrador. |
| `backend/` | Código da API, regras de negócio, autenticação, persistência e integrações. |
| `docs/` | Documentações do projeto, incluindo API, uso de IA, decisões técnicas e instruções. |
| `README.md` | Apresentação do projeto, instruções de execução, links e informações gerais. |
| `.gitignore` | Arquivos e pastas que não devem ser enviados ao GitHub, como `node_modules` e `.env`. |

Caso a equipe opte por usar dois repositórios separados, um para frontend e outro para backend, cada repositório deverá conter seu próprio `README.md`, instruções de execução e documentação mínima.

---

# Modelo de organização do frontend

A estrutura do frontend deverá favorecer componentização, reuso, separação entre interface, lógica e dados, além de preparar a aplicação para substituir a Fake API pelo backend real na Avaliação 2.

## Estrutura recomendada do frontend

```txt
frontend/
│
├── src/
│   │
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   │
│   │   ├── cadastro/
│   │   │   └── page.tsx
│   │   │
│   │   ├── produtos/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── artesoes/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── carrinho/
│   │   │   └── page.tsx
│   │   │
│   │   ├── pedidos/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── painel-artesao/
│   │   │   ├── page.tsx
│   │   │   ├── produtos/
│   │   │   ├── estoque/
│   │   │   └── pedidos/
│   │   │
│   │   ├── admin/
│   │   │   ├── page.tsx
│   │   │   ├── indicadores/
│   │   │   ├── produtos/
│   │   │   ├── artesoes/
│   │   │   └── pedidos/
│   │   │
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Badge.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── produto/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductList.tsx
│   │   │   ├── ProductFilters.tsx
│   │   │   └── ProductDetails.tsx
│   │   │
│   │   ├── artesao/
│   │   │   ├── ArtisanCard.tsx
│   │   │   └── ArtisanProfile.tsx
│   │   │
│   │   ├── carrinho/
│   │   │   ├── CartItem.tsx
│   │   │   └── CartSummary.tsx
│   │   │
│   │   ├── pedido/
│   │   │   ├── OrderCard.tsx
│   │   │   └── OrderStatus.tsx
│   │   │
│   │   ├── forms/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProductForm.tsx
│   │   │
│   │   └── feedback/
│   │       ├── LoadingState.tsx
│   │       ├── EmptyState.tsx
│   │       └── ErrorState.tsx
│   │
│   ├── services/
│   │   └── api/
│   │       ├── client.ts
│   │       ├── produtos.service.ts
│   │       ├── artesoes.service.ts
│   │       ├── carrinho.service.ts
│   │       ├── pedidos.service.ts
│   │       ├── usuarios.service.ts
│   │       └── recomendacoes.service.ts
│   │
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── cartStore.ts
│   │   └── productStore.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProdutos.ts
│   │   ├── useCarrinho.ts
│   │   └── usePedidos.ts
│   │
│   ├── types/
│   │   ├── produto.ts
│   │   ├── artesao.ts
│   │   ├── usuario.ts
│   │   ├── carrinho.ts
│   │   ├── pedido.ts
│   │   ├── avaliacao.ts
│   │   └── recomendacao.ts
│   │
│   ├── utils/
│   │   ├── formatCurrency.ts
│   │   ├── formatDate.ts
│   │   └── normalizeText.ts
│   │
│   ├── constants/
│   │   ├── categorias.ts
│   │   ├── regioes.ts
│   │   ├── tecnicas.ts
│   │   └── rotas.ts
│   │
│   ├── mocks/
│   │   ├── produtos.mock.ts
│   │   ├── artesoes.mock.ts
│   │   ├── usuarios.mock.ts
│   │   └── pedidos.mock.ts
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   └── images/
│
├── package.json
│
├── tsconfig.json
│
└── README.md
```

---

## Responsabilidade das principais pastas do frontend

| Pasta | Responsabilidade esperada |
| --- | --- |
| `app/` | Rotas e páginas da aplicação. Deve organizar as telas principais, mas não concentrar toda a lógica do sistema. |
| `components/` | Componentes reutilizáveis da interface. Devem ser organizados por domínio ou finalidade. |
| `components/ui/` | Componentes visuais genéricos, como botões, cards, inputs, modais e badges. |
| `components/layout/` | Estrutura visual geral, como cabeçalho, menu lateral, rodapé e layout base. |
| `components/produto/` | Componentes específicos de produtos, como card, lista, filtros e detalhes. |
| `components/artesao/` | Componentes relacionados ao perfil e à apresentação dos artesãos. |
| `components/carrinho/` | Componentes relacionados ao carrinho de compras. |
| `components/pedido/` | Componentes relacionados aos pedidos e status de compra. |
| `components/forms/` | Formulários de login, cadastro, produto, pedido e outros fluxos. |
| `components/feedback/` | Componentes para loading, erro e estado vazio. |
| `services/` | Comunicação com Fake API, API inicial ou backend real. |
| `store/` | Estados globais, como usuário autenticado, carrinho e dados compartilhados. |
| `hooks/` | Hooks personalizados para organizar lógica reutilizável. |
| `types/` | Tipagens TypeScript das entidades principais do projeto. |
| `utils/` | Funções auxiliares reutilizáveis. |
| `constants/` | Valores fixos usados em diferentes partes da aplicação. |
| `mocks/` | Dados sintéticos usados na Avaliação 1, quando houver Fake API estruturada. |
| `styles/` | Estilos globais da aplicação. |
| `public/` | Imagens e arquivos estáticos. |

---

## Regras esperadas para o frontend

A equipe deverá evitar:

- Colocar listas grandes de dados diretamente dentro de `page.tsx`.
- Concentrar toda a lógica de uma tela em um único arquivo.
- Repetir chamadas à API em várias páginas sem organização.
- Criar componentes muito grandes e difíceis de reutilizar.
- Usar `any` de forma excessiva.
- Misturar interface, regra de negócio e dados no mesmo arquivo.
- Manter dados mockados de forma desorganizada ou espalhada.

A equipe deverá priorizar:

- Páginas responsáveis principalmente por montar a tela.
- Componentes reutilizáveis e com responsabilidade clara.
- Services centralizando o consumo de dados.
- Hooks para lógica reutilizável.
- Stores para estados globais necessários.
- Tipagens para produtos, artesãos, usuários, carrinho e pedidos.
- Tratamento de loading, erro e estados vazios.
- Estrutura pronta para trocar Fake API por backend real na Avaliação 2.

---

# Modelo de organização do backend

O backend deverá ser organizado em camadas, separando rotas, controllers, services, repositories, middlewares, configurações e utilitários.

Essa organização ajuda a evitar que a regra de negócio fique concentrada nas rotas e facilita a manutenção da API ao longo do projeto.

## Estrutura recomendada do backend

```txt
backend/
│
├── src/
│   │
│   ├── routes/
│   │   ├── index.ts
│   │   ├── produtos.routes.ts
│   │   ├── artesoes.routes.ts
│   │   ├── usuarios.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── carrinho.routes.ts
│   │   ├── pedidos.routes.ts
│   │   ├── avaliacoes.routes.ts
│   │   ├── recomendacoes.routes.ts
│   │   └── admin.routes.ts
│   │
│   ├── controllers/
│   │   ├── produtos.controller.ts
│   │   ├── artesoes.controller.ts
│   │   ├── usuarios.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── carrinho.controller.ts
│   │   ├── pedidos.controller.ts
│   │   ├── avaliacoes.controller.ts
│   │   ├── recomendacoes.controller.ts
│   │   └── admin.controller.ts
│   │
│   ├── services/
│   │   ├── produtos.service.ts
│   │   ├── artesoes.service.ts
│   │   ├── usuarios.service.ts
│   │   ├── auth.service.ts
│   │   ├── carrinho.service.ts
│   │   ├── pedidos.service.ts
│   │   ├── avaliacoes.service.ts
│   │   ├── recomendacoes.service.ts
│   │   └── estoque.service.ts
│   │
│   ├── repositories/
│   │   ├── produtos.repository.ts
│   │   ├── artesoes.repository.ts
│   │   ├── usuarios.repository.ts
│   │   ├── carrinho.repository.ts
│   │   ├── pedidos.repository.ts
│   │   ├── avaliacoes.repository.ts
│   │   └── estoque.repository.ts
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── role.middleware.ts
│   │
│   ├── validators/
│   │   ├── produto.schema.ts
│   │   ├── usuario.schema.ts
│   │   ├── auth.schema.ts
│   │   └── pedido.schema.ts
│   │
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   │
│   │   └── seed.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   ├── database.ts
│   │   ├── cors.ts
│   │   ├── cache.ts
│   │   └── queue.ts
│   │
│   ├── cache/
│   │   ├── redis.client.ts
│   │   └── catalog.cache.ts
│   │
│   ├── queues/
│   │   ├── queue.client.ts
│   │   ├── order.queue.ts
│   │   └── notification.queue.ts
│   │
│   ├── jobs/
│   │   ├── updateIndicators.job.ts
│   │   └── processImages.job.ts
│   │
│   ├── integrations/
│   │   ├── ia.service.ts
│   │   └── recommendation.client.ts
│   │
│   ├── utils/
│   │   ├── AppError.ts
│   │   ├── httpStatus.ts
│   │   └── formatResponse.ts
│   │
│   ├── docs/
│   │   └── swagger.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── package.json
│
├── tsconfig.json
│
├── .env.example
│
└── README.md
```

---

## Responsabilidade das principais pastas do backend

| Pasta ou arquivo | Responsabilidade esperada |
| --- | --- |
| `routes/` | Definição das rotas da API e ligação com os controllers. |
| `controllers/` | Entrada das requisições. Deve receber dados, chamar services e devolver respostas. |
| `services/` | Regras de negócio da aplicação. |
| `repositories/` | Acesso ao banco de dados por meio do ORM. |
| `middlewares/` | Lógicas intermediárias, como autenticação, autorização, validação e tratamento de erros. |
| `validators/` | Schemas de validação dos dados recebidos pela API. |
| `database/` | Configuração do banco, Prisma, migrations e seed. |
| `config/` | Configurações da aplicação, ambiente, CORS, cache e filas. |
| `cache/` | Configuração e uso de cache, como Redis. |
| `queues/` | Filas e processamento assíncrono. |
| `jobs/` | Tarefas agendadas ou processamentos executados em segundo plano. |
| `integrations/` | Integrações com serviços externos ou módulos de outras disciplinas, como recomendação. |
| `utils/` | Funções e classes auxiliares reutilizáveis. |
| `docs/` | Configuração da documentação da API, quando houver Swagger ou equivalente. |
| `app.ts` | Configuração da aplicação, middlewares globais e rotas. |
| `server.ts` | Inicialização do servidor. |

---

## Regras esperadas para o backend

A equipe deverá evitar:

- Concentrar regra de negócio diretamente nas rotas.
- Fazer acesso ao banco diretamente nos controllers.
- Criar arquivos grandes com muitas responsabilidades.
- Misturar autenticação, validação, regra de negócio e persistência no mesmo lugar.
- Retornar respostas sem padronização.
- Ignorar tratamento de erros.
- Criar endpoints sem documentação.
- Usar dados em memória como substituto do banco na entrega final.

A equipe deverá priorizar:

- Rotas simples e bem nomeadas.
- Controllers responsáveis apenas por entrada e saída da requisição.
- Services concentrando regras de negócio.
- Repositories concentrando consultas ao banco.
- Middlewares para autenticação, autorização e tratamento de erros.
- Validações para dados recebidos pela API.
- Uso de ORM para persistência.
- Documentação clara dos endpoints.
- Separação entre autenticação, carrinho, pedidos, produtos e usuários.
- Cache em ponto crítico da aplicação.
- Processamento assíncrono conectado a uma necessidade real do sistema.

---

## Exemplo de fluxo esperado no backend

Para a criação de um pedido, a organização esperada pode seguir este fluxo:

```txt
routes/pedidos.routes.ts
│
└── chama
    controllers/pedidos.controller.ts
    │
    └── chama
        services/pedidos.service.ts
        │
        └── chama
            repositories/pedidos.repository.ts
            │
            └── acessa
                database/prisma/schema.prisma
```

Cada camada tem uma responsabilidade:

| Camada | Função |
| --- | --- |
| **Route** | Define o endpoint, como `POST /pedidos`. |
| **Controller** | Recebe a requisição, valida entrada básica e chama o service. |
| **Service** | Aplica regras de negócio, como verificar estoque, calcular total e criar pedido. |
| **Repository** | Faz a consulta ou alteração no banco de dados. |
| **Database** | Armazena os dados de forma persistente. |

</details>

<details>
<summary>🧾 TypeScript</summary>

O uso de TypeScript deve ser real e coerente.

A equipe deverá tipar:

- Entidades principais.
- Props de componentes.
- Dados retornados pela API.
- Dados enviados em formulários.
- Estados relevantes da aplicação.

O uso excessivo de `any` poderá prejudicar a avaliação.

</details>

<details>
<summary>🧱 Componentização</summary>

A interface deverá ser dividida em componentes reutilizáveis e com responsabilidades claras.

Evitem:

- Componentes muito grandes.
- Duplicação de código.
- Repetição de estruturas semelhantes em várias páginas.
- Mistura de UI, regra de negócio e acesso a dados no mesmo componente.

</details>

<details>
<summary>📡 API e services</summary>

O consumo de dados deve ser organizado em services ou camada equivalente.

Evitem chamadas diretas e repetidas à API espalhadas por muitas páginas ou componentes.

A aplicação deve tratar adequadamente:

- Loading.
- Erros.
- Estados vazios.
- Respostas inesperadas da API.

</details>

<details>
<summary>🗄️ Banco de dados e persistência</summary>

Na versão final, os dados principais da aplicação devem ser persistidos em banco de dados.

A equipe deverá garantir que os dados do sistema não dependam de arrays locais, arquivos mockados ou informações temporárias.

</details>

<details>
<summary>📘 Documentação</summary>

A documentação será parte da avaliação.

A equipe deverá manter:

- README atualizado.
- Instruções de instalação e execução.
- Explicação da arquitetura.
- Documentação das rotas da API.
- Exemplos de requisição e resposta.
- Informações sobre autenticação.
- Informações sobre deploy.

A documentação da API poderá ser feita com Swagger, OpenAPI, Postman, Insomnia ou equivalente.

</details>

---

# ⚠️ Pontos de atenção

| Atenção | O que significa |
| --- | --- |
| Não entreguem apenas telas | A interface precisa estar conectada a dados e fluxos reais ou simulados de forma organizada. |
| Não deixem a integração para o final | A equipe deve planejar contratos de API, dados, fluxos e integrações desde cedo. |
| Não deixem a IA isolada | O módulo de recomendação precisa aparecer dentro da aplicação. |
| Não ignorem carrinho e pedido | O fluxo de busca, carrinho e pedido será central na avaliação. |
| Não ignorem documentação | A documentação da API e o README fazem parte da entrega. |
| Não dependam apenas do local | O projeto precisa funcionar no ambiente publicado. |

---

# 🔄 Relação entre Avaliação 1 e Avaliação 2

| Avaliação 1 | Avaliação 2 |
| --- | --- |
| Frontend consome Fake API estruturada. | Frontend consome endpoints reais do backend. |
| Dados podem ser sintéticos. | Dados devem estar persistidos no banco. |
| Carrinho pode funcionar com estado local ou global. | Carrinho deve estar integrado ao backend e ao fluxo de pedido. |
| Recomendação pode estar planejada ou simulada. | Recomendação deve estar integrada à aplicação. |
| Autenticação pode estar em versão inicial ou planejada. | Autenticação deve estar funcional. |
| Documentação inicial pode listar rotas planejadas. | Documentação da API deve estar completa e atualizada. |

---

# 📚 Modelo mínimo de README

<details>
<summary>📄 Estrutura sugerida para o README</summary>

````markdown
# Nome do Projeto

## Descrição
Explique o objetivo da aplicação e o problema que ela resolve.

## Integrantes
Liste os integrantes da equipe.

## Tecnologias utilizadas
Liste frontend, backend, banco, autenticação, cache, fila e demais tecnologias.

## Como executar localmente
Explique o passo a passo para rodar frontend e backend.

## Variáveis de ambiente
Explique as variáveis necessárias e inclua um arquivo .env.example.

## Funcionalidades implementadas
Liste as funcionalidades entregues.

## Rotas da API
Liste endpoints, métodos, parâmetros e exemplos de resposta.

## Deploy
Inclua os links publicados.

## Evidências
Inclua prints, vídeo, testes ou observações relevantes.
````

</details>

---

# Declaração de uso de IA

Durante o desenvolvimento do Projeto Integrador, o uso de ferramentas de Inteligência Artificial é permitido como apoio ao processo de aprendizagem, desenvolvimento, revisão, documentação e resolução de problemas técnicos.

No entanto, todo uso de IA deverá ser declarado pela equipe no repositório do projeto, por meio do arquivo:

```txt
docs/uso-de-ia.md
```

🎯 **A declaração de uso de IA não tem como objetivo punir a equipe pelo uso dessas ferramentas.**

O objetivo é tornar o processo mais transparente, ajudar na avaliação técnica e permitir que a equipe demonstre que compreende, revisou, adaptou e validou tudo que foi incorporado ao projeto.

A equipe continuará sendo responsável por todo código, documentação, decisão técnica, funcionalidade e entrega final, mesmo quando houver apoio de IA.

<details>
<summary><strong>Leia com atenção como deverá ser feita a declaração de IA do projeto</strong></summary>

## Objetivo da declaração

A declaração de uso de IA deverá mostrar:

- Quais ferramentas foram utilizadas.
- Em quais partes do projeto houve apoio de IA.
- Que tipo de apoio foi solicitado.
- Quais resultados foram incorporados ao projeto.
- Quais adaptações foram feitas pela equipe.
- Como o conteúdo gerado ou sugerido foi revisado e validado.
- Quais limitações, erros ou problemas foram encontrados no uso da IA.

---

## Local obrigatório no repositório

A equipe deverá criar o arquivo abaixo no repositório do projeto:

```txt
docs/uso-de-ia.md
```

Caso a pasta `docs` ainda não exista, ela deverá ser criada.

Estrutura esperada:

```txt
projeto-origem/
  docs/
    uso-de-ia.md
  src/
  README.md
  package.json
```

---

## Quando esse arquivo será avaliado

O arquivo `docs/uso-de-ia.md` deverá ser entregue e atualizado nas duas avaliações.

| Avaliação | O que deve conter |
| --- | --- |
| Avaliação 1 | Registro inicial do uso de IA no frontend, organização do projeto, Fake API, componentes, services, hooks, tipagens, documentação e correção de bugs. |
| Avaliação 2 | Registro atualizado do uso de IA no backend, banco de dados, autenticação, integração, recomendação, processamento assíncrono, cache, testes, deploy e documentação final. |

---

## Como esse documento será usado na avaliação

A declaração de uso de IA poderá ser utilizada como apoio para a correção técnica e para a entrevista ou apresentação do projeto.

Se a equipe declarar que usou IA para apoiar a implementação de uma funcionalidade, os integrantes deverão ser capazes de explicar como essa funcionalidade funciona no projeto.

Exemplos:

- Se a IA foi usada para apoiar a autenticação, a equipe deverá explicar o fluxo de login, tokens, sessão, permissões e proteção de rotas.
- Se a IA foi usada para apoiar a criação de componentes, a equipe deverá explicar a organização, as props, a reutilização e as decisões de componentização.
- Se a IA foi usada para apoiar o backend, a equipe deverá explicar as rotas, controllers, services, repositories e regras de negócio.
- Se a IA foi usada para apoiar a integração com banco de dados, a equipe deverá explicar a modelagem, os relacionamentos e as consultas implementadas.

🎯 O uso de IA não substitui o domínio técnico da equipe.

---

## O que precisa ser declarado

A equipe deverá declarar o uso de IA em atividades como:

- Entendimento do problema.
- Pesquisa técnica.
- Organização de ideias.
- Prototipação de telas.
- Criação ou revisão de componentes.
- Escrita ou revisão de código.
- Tipagem com TypeScript.
- Estruturação de services, hooks, stores ou utils.
- Criação de rotas e endpoints.
- Organização do backend.
- Modelagem ou consulta ao banco de dados.
- Autenticação.
- Integração entre frontend e backend.
- Implementação de recomendação, cache ou processamento assíncrono.
- Criação de testes.
- Correção de bugs.
- Documentação.
- README.
- Deploy.

---

## O que não é adequado

A equipe deverá evitar:

- Copiar código gerado por IA sem compreender.
- Incorporar soluções sem testar.
- Entregar funcionalidades que a equipe não consegue explicar.
- Usar IA para gerar grandes partes do projeto sem revisão.
- Omitir o uso de IA em partes relevantes da entrega.
- Declarar apenas "usamos ChatGPT" sem explicar como a ferramenta foi utilizada.
- Usar prompts ou respostas da IA como substitutos da documentação técnica do projeto.

---

## Modelo para o arquivo `docs/uso-de-ia.md`

Copiem o modelo abaixo para o repositório da equipe e preencham ao longo do semestre.

````markdown
# Declaração de uso de IA

## 1. Declaração geral

A equipe utilizou ferramentas de Inteligência Artificial durante o desenvolvimento do Projeto Integrador?

- [ ] Sim
- [ ] Não

Caso tenha utilizado, descreva de forma geral como a IA apoiou o desenvolvimento do projeto.

Exemplo:

A equipe utilizou ferramentas de IA como apoio para pesquisa técnica, organização de ideias, revisão de código, estruturação de componentes, depuração, documentação e apoio na tomada de decisões técnicas. Todo conteúdo incorporado ao projeto foi revisado, adaptado, testado e compreendido pelos integrantes.

---

## 2. Ferramentas utilizadas

| Ferramenta | Finalidade de uso | Integrantes que utilizaram |
|---|---|---|
| ChatGPT |  |  |
| GitHub Copilot |  |  |
| Gemini |  |  |
| Claude |  |  |
| Outra |  |  |

---

## 3. Registro dos principais usos

| Data | Ferramenta | Uso realizado | Parte do projeto impactada | Resultado incorporado? | Revisão feita pela equipe |
|---|---|---|---|---|---|
|  |  |  |  | Sim / Não / Parcialmente |  |
|  |  |  |  | Sim / Não / Parcialmente |  |
|  |  |  |  | Sim / Não / Parcialmente |  |

Exemplo de preenchimento:

| Data | Ferramenta | Uso realizado | Parte do projeto impactada | Resultado incorporado? | Revisão feita pela equipe |
|---|---|---|---|---|---|
| 10/09/2026 | ChatGPT | Apoio para organizar a estrutura de services do frontend | Frontend, services | Parcialmente | A equipe adaptou a estrutura sugerida e testou o consumo dos dados |
| 18/09/2026 | GitHub Copilot | Sugestões de autocomplete em componentes | Frontend, componentes | Sim | O código foi revisado, ajustado e testado pela equipe |
| 25/10/2026 | ChatGPT | Apoio para entender middleware de autenticação | Backend, autenticação | Parcialmente | A equipe usou a explicação como referência e implementou solução própria |

---

## 4. Prompts ou descrições relevantes

Registrem os principais prompts utilizados ou descrevam claramente o que foi solicitado à IA.

Não é necessário registrar todas as interações pequenas, mas é obrigatório registrar os usos que influenciaram decisões, código, arquitetura, documentação ou funcionalidades importantes do projeto.

### Exemplo 1

Prompt ou descrição:

> Solicitamos apoio para organizar a estrutura de pastas do backend usando routes, controllers, services, repositories e middlewares.

Como a resposta foi utilizada:

> A resposta foi usada como referência inicial. A equipe adaptou a estrutura para o domínio do projeto Origem e implementou os recursos de produtos, usuários, carrinho e pedidos.

### Exemplo 2

Prompt ou descrição:

> Solicitamos sugestões para validar um formulário de cadastro de produto.

Como a resposta foi utilizada:

> A equipe aproveitou parte das regras sugeridas, ajustou os campos ao domínio do projeto e testou a validação no frontend.

---

## 5. Partes do projeto que tiveram apoio de IA

Marquem os itens em que houve uso de IA.

- [ ] Entendimento do problema
- [ ] Pesquisa técnica
- [ ] Prototipação de telas
- [ ] Estruturação do frontend
- [ ] Componentização
- [ ] Tipagem TypeScript
- [ ] Consumo de API
- [ ] Fake API
- [ ] Backend
- [ ] Banco de dados
- [ ] Autenticação
- [ ] Carrinho
- [ ] Pedidos
- [ ] Recomendação
- [ ] Processamento assíncrono
- [ ] Cache
- [ ] Testes
- [ ] Documentação
- [ ] README
- [ ] Deploy
- [ ] Correção de bugs
- [ ] Outro:

---

## 6. Validação humana

A equipe declara que:

- [ ] Todo código gerado ou sugerido por IA foi revisado pelos integrantes.
- [ ] O código incorporado foi testado antes da entrega.
- [ ] A equipe compreende as partes implementadas com apoio de IA.
- [ ] A equipe está apta a explicar tecnicamente as decisões tomadas.
- [ ] Nenhuma parte relevante foi incorporada sem análise, adaptação ou validação.
- [ ] As limitações, erros ou sugestões inadequadas da IA foram avaliadas pela equipe.

---

## 7. Limitações e problemas encontrados

Descrevam situações em que a IA sugeriu algo incorreto, incompleto, incompatível com o projeto ou que precisou ser descartado.

Exemplo:

A IA sugeriu uma estrutura de autenticação incompatível com a estratégia adotada pela equipe. A sugestão foi descartada e a equipe implementou uma solução própria com base nos requisitos do projeto.

Registro da equipe:

-
-
-

---

## 8. Responsabilidade da equipe

A equipe declara que todo conteúdo entregue no projeto foi revisado, compreendido e validado pelos integrantes.

A equipe reconhece que o uso de IA não substitui a responsabilidade técnica sobre o projeto e que todos os integrantes devem ser capazes de explicar as funcionalidades, decisões técnicas, código, integrações e documentação entregues.
````

---

## O uso de IA é permitido, mas precisa ser declarado.

A equipe deverá manter o arquivo `docs/uso-de-ia.md` atualizado ao longo do semestre, registrando como as ferramentas foram utilizadas e como os resultados foram revisados, adaptados e validados.

A declaração será usada para apoiar a avaliação técnica e verificar o domínio da equipe sobre o que foi entregue.

</details>

Este material complementar reúne orientações e modelos de prompts para apoiar o uso responsável de Inteligência Artificial no desenvolvimento do Projeto Integrador Origem. Ele deve ser utilizado pelas equipes como guia de apoio para pesquisa, organização técnica, revisão de código, documentação, depuração e preparação das entregas, sempre respeitando as tecnologias e critérios definidos pela disciplina de Desenvolvimento Web.

O uso de IA não substitui o domínio técnico da equipe e deverá ser registrado no arquivo `docs/uso-de-ia.md` do repositório.

*[Arquivo anexo na página original: `skills_ia_projeto_origem_sem_topico_stack.md`]*

Cada skill funciona como um ponto de partida para conversar com uma ferramenta de IA de forma mais direcionada, evitando perguntas genéricas e ajudando a obter respostas alinhadas ao escopo do Projeto Origem e às tecnologias da disciplina.

---

# Resumo final

## Avaliação 1

A equipe deverá entregar uma primeira versão navegável da aplicação, com frontend responsivo, telas principais, carrinho, perfis, Fake API estruturada, documentação inicial, deploy e vídeo demonstrativo.

## Avaliação 2

A equipe deverá entregar a aplicação full stack integrada, com frontend, backend, banco de dados, autenticação, recomendação, processamento assíncrono, cache, documentação completa da API, deploy final e vídeo demonstrativo do fluxo completo.
