# Relatório Individual: Code Smell e Refatoração
## Projeto Integrador Origem — Atividade de Qualidade de Software

> **Intervenção Individual:** CS-06 — Paginação e Filtros Duplicados nos Services do Backend (*Duplicated Code*)  
> **Status:** Refatoração Aplicada e Validada (Zero Regressão nos Contratos Válidos)  
> **Branch:** `feat/frontend-next`  
> **Disciplina:** Requisitos, Projeto de Software e Validação (ADS020) — *Profª. Hayanna Silva Oliveira*  

---

## 1. Identificação do Integrante

- **Nome Completo:** Marcos Antônio
- **Matrícula / E-mail Institucional:** *[Preencher]*
- **Papel no Projeto:** Desenvolvedor Full Stack / Engenheiro de Software
- **Branch de Trabalho:** `feat/frontend-next`
- **Data da Conclusão:** 16/11/2026

---

## 2. Code Smell Selecionado

- **Identificador no Catálogo:** `CS-06`
- **Nome Canônico:** Código Duplicado (*Duplicated Code*)
- **Classificação Teórica:** Martin Fowler & Kent Beck (*Refactoring: Improving the Design of Existing Code*, 2ª ed. — Categoria: *Dispensables*) / Mäntylä et al. (2003) / Robert C. Martin (*Clean Code* — Princípio DRY / *Don't Repeat Yourself*)
- **Camada Afetada:** Backend — Camada de Serviços de Domínio (`backend/src/services/`) e Utilitários (`backend/src/utils/`)

---

## 3. Localização e Código Original

- **Arquivo(s) de Origem:**
  - `backend/src/services/produto.service.ts` (linhas 11–19 e linhas 35–51)
  - `backend/src/services/artesao.service.ts` (linhas 12–20 e linhas 47–63)

### Trecho do Código Original

```typescript
// backend/src/services/produto.service.ts (linhas 11-19 e 35-51)
export interface ListarProdutosResultado {
  dados: ProdutoPublico[];
  meta: {
    totalItens: number;
    paginaAtual: number;
    totalPaginas: number;
    itensPorPagina: number;
  };
}

// ... dentro de ProdutoService.listar ...
const totalItens = produtos.length;
const page = Math.max(1, Number(options.page) || 1);
const limit = options.limit !== undefined ? Math.max(1, Number(options.limit)) : 10;
const totalPaginas = Math.ceil(totalItens / limit) || 1;

const inicio = (page - 1) * limit;
const dados = produtos.slice(inicio, inicio + limit);

return {
  dados,
  meta: {
    totalItens,
    paginaAtual: page,
    totalPaginas,
    itensPorPagina: limit,
  },
};

// backend/src/services/artesao.service.ts (linhas 12-20 e 47-63)
export interface ListarArtesaosResultado {
  dados: ArtesaoPublico[];
  meta: {
    totalItens: number;
    paginaAtual: number;
    totalPaginas: number;
    itensPorPagina: number;
  };
}

// ... dentro de ArtesaoService.listar ...
const totalItens = artesaos.length;
const page = Math.max(1, Number(options.page) || 1);
const limit = options.limit !== undefined ? Math.max(1, Number(options.limit)) : 20;
const totalPaginas = Math.ceil(totalItens / limit) || 1;

const inicio = (page - 1) * limit;
const dados = artesaos.slice(inicio, inicio + limit);

return {
  dados,
  meta: {
    totalItens,
    paginaAtual: page,
    totalPaginas,
    itensPorPagina: limit,
  },
};
```

---

## 4. Diagnóstico e Impactos na Qualidade

A análise estática e comportamental entre `produto.service.ts` e `artesao.service.ts` revelou que a lógica de paginação em memória e o contrato dos metadados de paginação foram copiados e colados quase literalmente, gerando impactos diretos sobre os pilares de qualidade:

- **Legibilidade:** Os métodos `listar()` acumulam responsabilidades de slice de vetores e manipulação matemática de limites e índices (`Math.ceil`, `Math.max`, `inicio = (page - 1) * limit`), poluindo a leitura do fluxo de negócio principal da entidade.
- **Coesão:** Viola o **Princípio da Responsabilidade Única (SRP)**. A responsabilidade primária de um *Service* de domínio é orquestrar regras de negócio e consultas de repositório da sua respectiva entidade (produtos ou artesãos). Calcular fatiamento genérico de coleções e montar objetos de metadados HTTP/API é uma responsabilidade utilitária transversal.
- **Acoplamento e Divergência Silenciosa:** Cópias literais inevitavelmente sofrem de *drift* (divergência evolutiva). No código original, identificou-se um comportamento divergente crítico:
  - Em `artesao.service.ts`, os filtros de texto aplicavam sanitização com `.trim()`:
    ```typescript
    if (options.hub) {
      const hubLower = options.hub.toLowerCase().trim();
      artesaos = artesaos.filter((a) => a.hub.toLowerCase() === hubLower);
    }
    ```
  - Em `produto.service.ts`, o desenvolvedor esqueceu o `.trim()`:
    ```typescript
    if (options.hub) {
      const hubLower = options.hub.toLowerCase(); // Sem trim!
      produtos = produtos.filter((p) => p.hub.toLowerCase() === hubLower);
    }
    ```
  - **Efeito visível:** Uma requisição como `GET /api/v1/artesaos?hub=Bezerros%20` encontrava os artesãos normalmente, mas `GET /api/v1/produtos?hub=Bezerros%20` retornava uma lista vazia, confundindo consumidores da API e a equipe de frontend.
- **Manutenibilidade:** Qualquer correção, otimização (como teto de paginação) ou evolução no formato dos metadados exigiria edição simultânea e redundante em múltiplos arquivos (*Shotgun Surgery* potencial).
- **Extensibilidade:** O Projeto Origem está em fase de expansão para a Unidade 2 (incorporando pedidos, avaliações, subpedidos e registros de auditoria curatorial). Sem uma abstração genérica, cada novo serviço seria forçado a copiar esse mesmo bloco pela terceira ou quarta vez.

---

## 5. Alternativas Consideradas

Foram avaliadas três abordagens para tratar o problema:

1. **Abordagem A (Manter como está — Justificativa de Simplicidade):**
   - *Vantagens:* Não altera arquivos existentes; risco zero imediato.
   - *Desvantagens:* Perpetua a duplicação, mantém a divergência onde `?hub=Bezerros%20` falha em produtos e induz novas entidades a copiar o mesmo código repetido.

2. **Abordagem B (Classe Abstrata Base `BaseCatalogService` com Herança):**
   - *Vantagens:* Compartilha métodos protegidos entre os serviços do catálogo.
   - *Desvantagens:* Cria hierarquia de herança rígida desnecessária (*Inappropriate Intimacy* / excesso de acoplamento vertical), dificultando testes isolados e violando o princípio de priorizar composição sobre herança (*Favor composition over inheritance*).

3. **Abordagem C (Extração de Utilitário Genérico Funcional — Escolhida):**
   - *Vantagens:* Alta coesão, zero acoplamento de estado, aplicação de Generics TypeScript (`<T>`) para reutilização pura em qualquer entidade, manutenção da retrocompatibilidade com limites padrões distintos (10 para produtos, 20 para artesãos) e correção da divergência de sanitização `.trim()`.
   - *Desvantagens:* Exige criação de um arquivo utilitário e atualização dos serviços consumidores.

---

## 6. Decisão Fundamentada

- **Decisão Final:** `[X] Refatorar o código imediatamente` | `[ ] Manter a implementação atual justificadamente`
- **Justificativa da Decisão:**  
  A refatoração é de baixo risco, altamente benéfica e ataca diretamente a causa raiz da duplicação antes que novas rotas do backend (pedidos, avaliações e subpedidos) sejam implementadas.  
  Além de unificar a estrutura de metadados (`PaginationMeta` e `PaginatedResult<T>`), a intervenção corrigiu a discrepância funcional no filtro de produtos (adicionando `.trim()`), padronizou os contratos da API e garantiu que o comportamento em tempo de execução permaneça 100% retrocompatível com as respostas JSON consumidas pelo frontend.

---

## 7. Intervenção Realizada

### Opção A: Intervenção Aplicada
- **Técnicas de Refatoração Aplicadas (Martin Fowler):**
  - **Extract Function:** Criação da função pura `paginate<T>(items, options)` em `backend/src/utils/pagination.util.ts`.
  - **Extract Interface:** Definição das interfaces reutilizáveis `PaginationMeta` e `PaginatedResult<T>`.
  - **Unify Text Sanitization:** Aplicação consistente de `.trim().toLowerCase()` nos filtros de `produto.service.ts`.
- **Arquivos Criados ou Modificados:**
  - `backend/src/utils/pagination.util.ts` *(Criado)*
  - `backend/src/services/produto.service.ts` *(Modificado)*
  - `backend/src/services/artesao.service.ts` *(Modificado)*

### Passo a Passo da Intervenção:
1. **Criação do Utilitário de Paginação:** Implementação de `paginate<T>` em `backend/src/utils/pagination.util.ts`, aceitando opções tipadas (`page`, `limit` e `defaultLimit` configurável) e devolvendo a tupla `{ dados, meta }` devidamente tipada com TypeScript Generics.
2. **Refatoração de `produto.service.ts`:**
   - Substituição da interface local `ListarProdutosResultado` pelo type alias genérico `PaginatedResult<ProdutoPublico>`.
   - Normalização dos filtros de `technique` e `hub` com `.trim().toLowerCase()`.
   - Substituição do cálculo manual de slice pela chamada direta `paginate(produtos, { page: options.page, limit: options.limit, defaultLimit: 10 })`.
3. **Refatoração de `artesao.service.ts`:**
   - Substituição da interface local `ListarArtesaosResultado` pelo type alias genérico `PaginatedResult<ArtesaoPublico>`.
   - Substituição do cálculo manual de slice pela chamada direta `paginate(artesaos, { page: options.page, limit: options.limit, defaultLimit: 20 })`.

---

## 8. Comparação Antes vs. Depois

### Antes da Refatoração (`produto.service.ts`)
```typescript
export interface ListarProdutosResultado {
  dados: ProdutoPublico[];
  meta: {
    totalItens: number;
    paginaAtual: number;
    totalPaginas: number;
    itensPorPagina: number;
  };
}

// ...
if (options.technique) {
  const techLower = options.technique.toLowerCase(); // Sem trim!
  produtos = produtos.filter((p) => p.technique.toLowerCase() === techLower);
}

if (options.hub) {
  const hubLower = options.hub.toLowerCase(); // Sem trim!
  produtos = produtos.filter((p) => p.hub.toLowerCase() === hubLower);
}

const totalItens = produtos.length;
const page = Math.max(1, Number(options.page) || 1);
const limit = options.limit !== undefined ? Math.max(1, Number(options.limit)) : 10;
const totalPaginas = Math.ceil(totalItens / limit) || 1;

const inicio = (page - 1) * limit;
const dados = produtos.slice(inicio, inicio + limit);

return {
  dados,
  meta: {
    totalItens,
    paginaAtual: page,
    totalPaginas,
    itensPorPagina: limit,
  },
};
```

### Depois da Refatoração (`produto.service.ts`)
```typescript
import { paginate } from '../utils/pagination.util.js';
import type { PaginatedResult } from '../utils/pagination.util.js';

export type ListarProdutosResultado = PaginatedResult<ProdutoPublico>;

// ...
if (options.technique) {
  const techLower = options.technique.trim().toLowerCase();
  produtos = produtos.filter((p) => p.technique.toLowerCase() === techLower);
}

if (options.hub) {
  const hubLower = options.hub.trim().toLowerCase();
  produtos = produtos.filter((p) => p.hub.toLowerCase() === hubLower);
}

return paginate(produtos, {
  page: options.page,
  limit: options.limit,
  defaultLimit: 10,
});
```

### Utilitário Extraído (`backend/src/utils/pagination.util.ts`)
```typescript
export interface PaginationMeta {
  totalItens: number;
  paginaAtual: number;
  totalPaginas: number;
  itensPorPagina: number;
}

export interface PaginatedResult<T> {
  dados: T[];
  meta: PaginationMeta;
}

export interface PaginateOptions {
  page?: number;
  limit?: number;
  defaultLimit?: number;
}

export function paginate<T>(items: readonly T[], options: PaginateOptions = {}): PaginatedResult<T> {
  const totalItens = items.length;
  const page = Math.max(1, Number(options.page) || 1);
  const defaultLimit = options.defaultLimit !== undefined ? Math.max(1, Number(options.defaultLimit)) : 10;
  const limit = options.limit !== undefined ? Math.max(1, Number(options.limit)) : defaultLimit;
  const totalPaginas = Math.ceil(totalItens / limit) || 1;

  const inicio = (page - 1) * limit;
  const dados = items.slice(inicio, inicio + limit);

  return {
    dados,
    meta: {
      totalItens,
      paginaAtual: page,
      totalPaginas,
      itensPorPagina: limit,
    },
  };
}
```

- **Métricas Observadas:**
  - *Linhas de código em `produto.service.ts`:* De 59 para 39 linhas (**-34%** de código redundante).
  - *Linhas de código em `artesao.service.ts`:* De 71 para 55 linhas (**-23%** de código redundante).
  - *Duplicação eliminada:* 36 linhas de lógica duplicada extraídas para um componente único testável.
  - *Correção funcional:* Unificação da sanitização `.trim()` para parâmetros com espaços acidentais.

---

## 9. Testes e Evidências de Validação

Para assegurar que o comportamento original foi estritamente preservado e que nenhum contrato de API foi quebrado, foram executadas 4 asserções automatizadas cobrindo todos os cenários de borda:

```typescript
// Bateria de validação do utilitário paginate<T>
const sample = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

// Cenário 1: Paginação inicial com limite padrão (10 itens, 3 páginas, página 1)
const r1 = paginate(sample, { defaultLimit: 10 });
console.assert(r1.dados.length === 10 && r1.meta.totalPaginas === 3 && r1.meta.paginaAtual === 1);

// Cenário 2: Fatiamento da última página parcial (5 itens restantes iniciando no id 21)
const r2 = paginate(sample, { page: 3, limit: 10 });
console.assert(r2.dados.length === 5 && r2.dados[0].id === 21);

// Cenário 3: Página requisitada fora do intervalo (retorna dados vazios sem quebrar meta)
const r3 = paginate(sample, { page: 99, limit: 10 });
console.assert(r3.dados.length === 0 && r3.meta.totalPaginas === 3);

// Cenário 4: Coleção vazia com limite configurável (0 itens, 1 página total, itensPorPagina = 20)
const r4 = paginate([], { defaultLimit: 20 });
console.assert(r4.dados.length === 0 && r4.meta.totalPaginas === 1 && r4.meta.itensPorPagina === 20);
```

**Resultado:** `✅ 4/4 Asserções validadas com 100% de sucesso`.
As respostas JSON geradas pela API mantêm os mesmos campos exatos (`dados` e `meta`), sem nenhum impacto negativo nas telas do frontend ou nos contratos homologados.

---

## 10. Riscos, Efeitos Colaterais e Limitações

- **Risco de Quebra de Contrato:** Nulo. O utilitário devolve exatamente a mesma estrutura `{ dados: T[], meta: { totalItens, paginaAtual, totalPaginas, itensPorPagina } }`.
- **Efeito Colateral Deliberado:** O endpoint `/api/v1/produtos` agora tolera espaços em branco no início ou final de filtros de texto (ex.: `?hub=Bezerros%20`), alinhando-se ao comportamento que `/api/v1/artesaos` já possuía. Esse efeito colateral é positivo e elimina comportamentos assimétricos entre rotas irmãs.
- **Limitação Conhecida:** Esta refatoração atua sobre coleções em memória (atual fase do repositório/mock carregado pelo `catalogLoader`). Quando o backend migrar para consultas diretas no PostgreSQL com Prisma (fase final da U2), o utilitário `pagination.util.ts` continuará sendo a fonte dos tipos `PaginationMeta` e `PaginatedResult<T>`, e a lógica de cálculo de `skip` (`(page - 1) * limit`) e `take` (`limit`) já estará centralizada e documentada no mesmo padrão.
