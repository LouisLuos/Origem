# Relatório Individual: Code Smell e Refatoração
## Projeto Integrador Origem — Atividade de Qualidade de Software

> **Intervenção Individual:** CS-02 — Mudança Divergente no Serviço de Catálogo (*Divergent Change*)
> **Status:** Refatoração aplicada; build, typecheck e lint focado registrados como aprovados
> **Branch:** `feat/frontend-next`
> **Data da intervenção registrada:** 16 de novembro de 2026

---

## 1. Identificação do Integrante

- **Nome Completo:** *[Confirmar nome civil do autor do commit]*
- **Matrícula / E-mail Institucional:** *[Preencher]*
- **Identificação registrada no Git:** `gitviini <gvinicius105@gmail.com>`
- **Papel no Projeto:** Desenvolvedor Frontend / Engenheiro de Software
- **Branch de Trabalho:** `feat/frontend-next`
- **Data da Conclusão da Intervenção:** 16 de novembro de 2026

---

## 2. Code Smell Selecionado

- **Identificador no Catálogo:** `CS-02`
- **Nome Canônico:** Mudança Divergente (*Divergent Change*)
- **Classificação Teórica:** Martin Fowler, *Refactoring: Improving the Design of Existing Code*, 2ª ed. — categoria *Change Preventers* na taxonomia de Mäntylä et al. (2003).
- **Camada Afetada:** Frontend — serviços de catálogo e estoque (`frontend/src/services/`) e seus consumidores (`CatalogContext.tsx` e `orderService.ts`).
- **Severidade:** Média.

O caso não foi classificado como *Large Class*: a implementação original tinha 83 linhas. O problema era que razões de mudança distintas — consultas públicas, gestão cadastral e operações de estoque — estavam reunidas no mesmo serviço.

---

## 3. Localização e Código Original

- **Arquivo de origem:** `frontend/src/services/catalogService.ts`
- **Consumidores envolvidos:** `frontend/src/context/CatalogContext.tsx` e `frontend/src/services/orderService.ts`

### Trecho representativo antes da refatoração

O objeto `catalogService` expunha operações de consulta, escrita do catálogo e estoque sob uma única interface:

```typescript
export const catalogService = {
  async list(): Promise<CatalogItem[]> {
    const response = await request<ProductListResponse>('/produtos?limit=100')
    return response.dados
  },

  async get(id: string): Promise<CatalogItem> {
    return request<CatalogItem>(`/produtos/${encodeURIComponent(id)}`)
  },

  async create(owner: Owner, input: CatalogItemInput): Promise<CatalogItem> {
    return request<CatalogItem>('/produtos', {
      method: 'POST',
      body: JSON.stringify({ ...input, ownerEmail: owner.email, artisan: owner.name }),
    })
  },

  async update(id: string, patch: Partial<CatalogItemInput>): Promise<CatalogItem> {
    return request<CatalogItem>(`/produtos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },

  async adjustStock(id: string, delta: number): Promise<CatalogItem> {
    const current = await catalogService.get(id)
    return request<CatalogItem>(`/produtos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock: Math.max(0, current.stock + delta) }),
    })
  },

  async remove(id: string): Promise<void> {
    await request<void>(`/produtos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  async reserveStock(lines: StockReservation[]): Promise<CatalogItem[]> {
    const response = await request<ProductListResponse>('/estoque/reservas', {
      method: 'POST',
      body: JSON.stringify({ lines }),
    })
    return response.dados
  },
}
```

Além das responsabilidades misturadas, o mesmo módulo declarava os tipos do catálogo, do proprietário e da reserva, e mantinha localmente o wrapper de requisições HTTP.

---

## 4. Diagnóstico e Impactos na Qualidade

O serviço reunia três grupos funcionais com consumidores e motivos de mudança diferentes:

1. **Consulta pública:** listagem e detalhe de produto para vitrine e páginas.
2. **Gestão cadastral:** criação, atualização e remoção de produto pelo fluxo do artesão.
3. **Estoque:** ajuste de saldo pelo painel e reserva durante o fluxo de pedido/checkout.

Essa concentração caracteriza *Divergent Change*: mudanças em fluxos independentes levavam ao mesmo objeto de serviço, ampliando a superfície que precisava ser entendida e alterada.

- **Coesão:** baixa coesão funcional, pois consultas, mutações de cadastro e estoque estavam no mesmo módulo.
- **Acoplamento:** `CatalogContext` e `orderService` importavam operações de uma API de serviço mais ampla do que cada consumidor precisava.
- **Manutenibilidade:** mudanças em regras de estoque ou cadastro podiam alterar o arquivo que também sustentava a vitrine, aumentando o risco de alterações incidentais.
- **Legibilidade:** o nome `catalogService` não deixava claro que o objeto também coordenava estoque e reserva de pedidos.
- **Extensibilidade:** novos fluxos de escrita ou estoque tenderiam a acrescentar métodos ao mesmo serviço em vez de explicitar seus limites funcionais.
- **Contratos:** o serviço centralizava URLs, métodos HTTP, corpos das requisições e fallback de erro. A extração precisava preservar esses detalhes para não mudar o comportamento dos consumidores.

---

## 5. Alternativas Consideradas

1. **Manter um serviço único:**
   - **Vantagem:** nenhuma alteração de imports ou organização dos serviços.
   - **Desvantagem:** mantém razões de mudança distintas concentradas e faz cada consumidor depender da interface completa.

2. **Criar um serviço por tela/consumidor:**
   - **Vantagem:** cada tela poderia ter sua própria interface.
   - **Desvantagem:** duplicaria detalhes HTTP e regras comuns entre telas, sem representar os limites funcionais do domínio.

3. **Separar por responsabilidade e compartilhar o transporte HTTP — escolhida:**
   - **Vantagem:** serviços pequenos e coesos para consulta, gestão cadastral e estoque; tipos e chamada HTTP compartilhados para evitar duplicação.
   - **Desvantagem:** mais módulos e imports para manter, compensados pela clareza das responsabilidades.

---

## 6. Decisão Fundamentada

- **Decisão Final:** `[X] Refatorar` | `[ ] Manter a implementação atual justificadamente`
- **Justificativa:** a separação tem escopo estrutural e mantém a API pública usada pelos consumidores (`CatalogContext` e `orderService`). Consultas, alterações cadastrais e estoque têm motivos de evolução diferentes; reuni-los num único objeto tornava as dependências menos explícitas. A extração preservou rotas, métodos, payloads e mensagens de erro, sem tentar implementar operações que ainda não existem no backend.

---

## 7. Intervenção Realizada

### Técnicas aplicadas

- **Extract Module / Move Function:** operações movidas para serviços que representam seus contextos.
- **Extract Module:** tipos do catálogo e wrapper HTTP compartilhado extraídos para módulos próprios.
- Atualização dos consumidores para importar os serviços específicos.

### Arquivos criados

1. `frontend/src/services/artisanCatalogService.ts`: operações de gestão cadastral — `create`, `update` e `remove`.
2. `frontend/src/services/stockService.ts`: operações de estoque — `adjustStock` e `reserveStock`.
3. `frontend/src/services/catalogTypes.ts`: tipos `CatalogItem`, `CatalogItemInput`, `Owner` e `StockReservation`.
4. `frontend/src/services/catalogRequest.ts`: wrapper comum que delega a `apiRequest` com a mensagem de fallback do catálogo.

### Arquivos modificados

1. `frontend/src/services/catalogService.ts`: permaneceu responsável apenas por `list` e `get`.
2. `frontend/src/context/CatalogContext.tsx`: passou a chamar serviços de catálogo/gestão/estoque conforme a operação.
3. `frontend/src/services/orderService.ts`: passou a usar `stockService.reserveStock()` durante a criação do pedido.

### Organização após a refatoração

```typescript
// catalogService.ts — consultas públicas
export const catalogService = {
  async list(): Promise<CatalogItem[]> {
    const response = await catalogRequest<ProductListResponse>('/produtos?limit=100')
    return response.dados
  },

  async get(id: string): Promise<CatalogItem> {
    return catalogRequest<CatalogItem>(`/produtos/${encodeURIComponent(id)}`)
  },
}
```

```typescript
// artisanCatalogService.ts — gestão cadastral
export const artisanCatalogService = {
  async create(owner: Owner, input: CatalogItemInput): Promise<CatalogItem> {
    return catalogRequest<CatalogItem>('/produtos', {
      method: 'POST',
      body: JSON.stringify({ ...input, ownerEmail: owner.email, artisan: owner.name }),
    })
  },
  // update e remove permanecem neste serviço
}
```

```typescript
// stockService.ts — operações de estoque
export const stockService = {
  async adjustStock(id: string, delta: number): Promise<CatalogItem> {
    const current = await catalogService.get(id)
    return catalogRequest<CatalogItem>(`/produtos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock: Math.max(0, current.stock + delta) }),
    })
  },
  // reserveStock permanece neste serviço
}
```

---

## 8. Comparação Antes vs. Depois

| Aspecto | Antes | Depois |
| :--- | :--- | :--- |
| Consultas públicas | `catalogService.list/get` | Mantidas em `catalogService.list/get` |
| Gestão de cadastro | Misturada em `catalogService.create/update/remove` | Separada em `artisanCatalogService` |
| Estoque e reserva | Misturados em `catalogService.adjustStock/reserveStock` | Separados em `stockService` |
| Tipos de domínio do catálogo | Declarados em `catalogService.ts` | Extraídos para `catalogTypes.ts` |
| Wrapper e mensagem de fallback HTTP | Função local `request<T>` | `catalogRequest<T>` compartilhado |
| Consumidores | Dependiam do serviço abrangente | `CatalogContext` e `orderService` importam o serviço adequado |
| Tamanho do serviço de consultas | 83 linhas com responsabilidades distintas | 20 linhas com `list` e `get` |

O resultado não elimina a necessidade de coordenação entre serviços que atuam sobre o mesmo catálogo; torna explícito qual módulo é responsável por cada tipo de operação, sem alterar os contratos existentes no frontend.

---

## 9. Testes e Evidências de Validação

O registro coletivo da intervenção informa:

- **Build de produção:** `npm run build` no frontend — aprovado.
- **Checagem de tipos:** executada no build de produção — aprovada.
- **ESLint focado:** arquivos alterados — aprovado.
- **Lint global:** encontrou 214 erros em `frontend/dist`, conteúdo gerado/versionado fora do escopo desta refatoração.
- **Navegação manual:** não executada/registrada.
- **Testes automatizados específicos do CS-02:** não há evidência de suíte ou comparação HTTP antes/depois no relatório coletivo.

A validação sustenta a compilação e a consistência estática da alteração. A preservação dos contratos foi verificada pela manutenção de URLs, métodos HTTP, payloads e mensagens de erro no diff da refatoração; não se deve interpretar isso como uma bateria automatizada de regressão de endpoints.

### Limites da integração com o backend

Na data do mapeamento, o backend implementava apenas `GET /produtos` e `GET /produtos/:id`. Assim, `create`, `update`, `remove` e as chamadas de escrita de estoque continuam sem rotas correspondentes e podem falhar na integração. A refatoração do frontend não cria essas rotas nem torna as operações funcionais.

`adjustStock` continua fazendo leitura do saldo e escrita calculada no cliente, portanto permanece sujeito a condição de corrida. A reserva atômica depende de implementação transacional no backend. Esses pontos são limitações preexistentes e estão fora do escopo do CS-02.

---

## 10. Benefícios Alcançados, Riscos e Limitações

- **Benefícios:**
  - Responsabilidades de consulta, cadastro e estoque ficaram explícitas em módulos distintos.
  - A vitrine depende apenas dos métodos de consulta de catálogo.
  - O checkout utiliza diretamente o serviço de estoque para reservar itens.
  - Tipos e transporte HTTP compartilhados evitam replicar contratos e wrapper de requisição.
  - O escopo de alterações futuras fica mais localizado por contexto funcional.
- **Riscos e limitações:**
  - A extração não resolve endpoints de escrita ausentes no backend.
  - O cálculo de `adjustStock` no cliente continua vulnerável a concorrência.
  - O lint global inclui falhas em `frontend/dist`; o lint focado nos arquivos alterados foi aprovado.
  - Não foi registrada navegação manual nem uma bateria automatizada de testes de integração para esta alteração.
  - O tipo `CatalogItem` ainda depende do tipo `Product` declarado no Design System; esse acoplamento corresponde ao candidato CS-14 e não foi alterado nesta intervenção.

---

## 11. Rastreabilidade Git

- **Commit de referência da refatoração:** `ecf69db012b0082df6fd14adffcc8380abd32e4f`
- **Mensagem:** `fix: CS-02 of mapping code smells`
- **Autor registrado no Git:** `gitviini <gvinicius105@gmail.com>` (*confirmar nome completo e matrícula para a identificação acadêmica*)
- **Data:** 16 de novembro de 2026
- **Branch:** `feat/frontend-next`

O commit também contém alterações em documentação e em `backend/.env.example`; o hash acima é a referência de rastreabilidade disponível no histórico, não uma afirmação de que o commit contém exclusivamente o CS-02.

---

## 12. Roteiro Sintético para Apresentação em Sala

1. **O Problema (30 seg):**
   *"Identifiquei o CS-02, Mudança Divergente, em `catalogService.ts`. O módulo reunia consultas da vitrine, cadastro de produtos e operações de estoque, embora cada grupo tenha consumidores e motivos de mudança próprios."*
2. **A Avaliação Crítica e Decisão (45 seg):**
   *"O problema não era o tamanho do arquivo — eram 83 linhas — mas a mistura de responsabilidades. Optei por separar os serviços, mantendo URLs, métodos, corpos de requisição e mensagens de erro. Também preservei o comportamento existente, sem tentar resolver aqui as rotas que ainda faltam no backend."*
3. **A Intervenção e Resultados (45 seg):**
   *"Consultas ficaram em `catalogService`, mutações de cadastro em `artisanCatalogService` e estoque em `stockService`. Extraí tipos e a chamada HTTP comum, e atualizei `CatalogContext` e `orderService`. O build, o typecheck e o lint focado foram aprovados; não houve registro de navegação manual."*
4. **Lição Aprendida (30 seg):**
   *"Um serviço não precisa ser grande para ter mudança divergente. Separar módulos por motivo de mudança deixa as dependências mais claras, mas uma refatoração estrutural não substitui a implementação de contratos ausentes nem resolve a atomicidade do estoque."*
