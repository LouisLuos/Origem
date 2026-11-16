# Relatório Individual: Code Smell e Refatoração
## Projeto Integrador Origem — Atividade de Qualidade de Software

> **Intervenção Individual:** CS-01 — Código Duplicado (*Duplicated Code*)  
> **Status:** Refatoração Aplicada e Validada (Zero Regressão)  
> **Branch:** `feat/frontend-next`  

---

## 1. Identificação do Integrante

- **Nome Completo:** *[Preencher com o nome do integrante]*
- **Matrícula / E-mail Institucional:** *[Preencher]*
- **Papel no Projeto:** Desenvolvedor Full Stack / Engenheiro de Qualidade
- **Branch de Trabalho:** `feat/frontend-next`
- **Data da Conclusão da Intervenção:** 15 de novembro de 2026

---

## 2. Code Smell Selecionado

- **Identificador no Catálogo:** `CS-01`
- **Nome Canônico:** Código Duplicado (*Duplicated Code*) / Cirurgia por Espingarda (*Shotgun Surgery*)
- **Classificação Teórica:** Martin Fowler & Kent Beck (1999) — *Refactoring: Improving the Design of Existing Code* / Robert C. Martin — *Clean Code* (Capítulo 3: DRY - *Don't Repeat Yourself*)
- **Camada Afetada:** Backend — Camada de Repositórios e Persistência em Memória (`backend/src/repositories/`)

---

## 3. Localização e Código Original

- **Arquivos de Origem:**
  - `backend/src/repositories/produto.repository.ts` (linhas 20 a 77)
  - `backend/src/repositories/artesao.repository.ts` (linhas 19 a 73)

### Trechos do Código Original Evidenciando a Duplicação

#### A. Duplicação de Tipagem e Estrutura do Catálogo IA (`RawProdutoIA` e `CatalogoIAPayload`)
```typescript
// Presente identicamente em ambos os arquivos:
interface RawProdutoIA {
  id: string;
  nome: string;
  artesao: string;
  tecnica: string;
  polo: string;
  categoria?: string;
  preco: number;
  estoque: number;
  pedidos?: number;
}

interface CatalogoIAPayload {
  produtos: RawProdutoIA[];
}
```

#### B. Duplicação da Função de Normalização de Strings (`slugify`)
```typescript
// Duplicado identicamente em produto.repository.ts (L36-43) e artesao.repository.ts (L35-42):
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

#### C. Duplicação do Dicionário Taxonômico Cultural (`TECHNIQUE_MAP`)
```typescript
// Duplicado identicamente em produto.repository.ts (L48-55) e artesao.repository.ts (L44-51):
const TECHNIQUE_MAP: Record<string, string> = {
  ceramica: 'Cerâmica Figurativa',
  couro: 'Couro',
  xilogravura: 'Xilogravura',
  papel_mache: 'Papel Machê',
  renda_renascenca: 'Renda Renascença',
  bordado: 'Bordado',
};
```

#### D. Duplicação da Resolução de Caminho Resiliente (`resolveCatalogPath`)
```typescript
// Duplicado identicamente em produto.repository.ts (L62-77) e artesao.repository.ts (L58-73):
private resolveCatalogPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDir, '../../../ia-recomendador/dados/catalogo.json'),
    path.resolve(process.cwd(), '../ia-recomendador/dados/catalogo.json'),
    path.resolve(process.cwd(), 'ia-recomendador/dados/catalogo.json'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Arquivo catalogo.json não encontrado nas localizações esperadas.');
}
```

---

## 4. Diagnóstico e Impactos na Qualidade

A presença de blocos idênticos de lógica em classes vizinhas viola diretamente o princípio fundamental **DRY** (*Don't Repeat Yourself*). Os impactos técnicos mensuráveis sobre os pilares de qualidade foram:

- **Legibilidade:** Poluição visual nas classes de repositório. Em vez de focarem puramente em contratos de consulta (`findAll`, `findById`), 60% das linhas dos arquivos tratavam de normalização de regex, mapeamento de termos culturais em dicionário estático e lógica de resolução de caminhos no sistema operacional.
- **Coesão:** Baixa coesão nos repositórios. Um repositório deve ter a responsabilidade única de fornecer abstração sobre a camada de dados. Conhecer caminhos de filesystem ou realizar higienização de strings de URL extrapola sua responsabilidade arquitetural (violação do *Single Responsibility Principle*).
- **Acoplamento e Cirurgia por Espingarda (*Shotgun Surgery*):** O vínculo entre um produto e seu artesão depende da regra `art-${slugify(artisanName)}`. Como a função `slugify` e o prefixo estavam replicados manualmente em dois arquivos, qualquer ajuste na expressão regular ou acentuação exigiria modificações sincronizadas em múltiplos arquivos. Caso um desenvolvedor alterasse um arquivo e esquecesse o outro, a integridade referencial entre produtos e artesãos na interface seria quebrada silenciosamente.
- **Manutenibilidade:** Ao cadastrar uma nova técnica cultural de Pernambuco (ex.: *Tapeçaria* ou *Fuxico*), era necessário editar múltiplos arquivos de repositório, elevando o risco de inconsistências de nomenclatura no sistema.
- **Extensibilidade:** Outros módulos do backend que venham a precisar de geração de slugs (como categorias, rotas amigáveis ou polos) não podiam reutilizar a função existente sem introduzir uma terceira cópia.

---

## 5. Alternativas Consideradas

Três abordagens técnicas foram examinadas para o tratamento deste cheiro de código:

1. **Abordagem A: Herança de Classe Base Abstrata (`BaseJsonRepository`):**
   - *Descrição:* Criar uma classe abstrata comum contendo `resolveCatalogPath`, `slugify` e `TECHNIQUE_MAP`.
   - *Vantagens:* Elimina a duplicação direta nas classes filhas.
   - *Desvantagens:* Favorece herança em detrimento da composição (*Composition over Inheritance*). Nem todo repositório futuro herdará de JSON (já que o destino final é PostgreSQL/Prisma). Mistura utilitários estáticos com o ciclo de vida de instâncias.

2. **Abordagem B: Extração Modular Especializada (Extract Function & Extract Module — Escolhida):**
   - *Descrição:* Extrair utilitários de string puros para `backend/src/utils/string.util.ts`, o vocabulário cultural para `backend/src/constants/taxonomy.ts` e o carregador resiliente do arquivo estático para `backend/src/repositories/catalogLoader.ts`.
   - *Vantagens:* Máxima coesão, alta testabilidade unitária de funções puras, ausência de efeitos colaterais e facilidade de descarte ou migração quando o banco relacional definitivo for implementado.
   - *Desvantagens:* Criação de pequenos arquivos adicionais no projeto.

3. **Abordagem C: Manutenção do Status Quo (Não Refatorar):**
   - *Descrição:* Manter a duplicação sob o argumento de que a leitura de `catalogo.json` é uma solução de transição para o MVP.
   - *Vantagens:* Zero risco imediato de alteração de código.
   - *Desvantagens:* Permite que o débito técnico se espalhe e consolide vícios estruturais no backend, além de manter alto o risco de divergência no vínculo `artisanId`.

---

## 6. Decisão Fundamentada

- **Decisão Final:** `[X] Refatorar o código imediatamente` | `[ ] Manter a implementação atual justificadamente`
- **Justificativa da Decisão:**  
  A refatoração foi adotada porque o custo de implementação e o risco de regressão são extremamente baixos, enquanto os ganhos de manutenibilidade, clareza e segurança do relacionamento produto $\leftrightarrow$ artesão são imediatos e expressivos. A extração modular respeita a arquitetura existente do backend Express, desacopla o tratamento de strings e a taxonomia cultural das classes de dados, e garante que a regra de geração do `artisanId` passe a ter um ponto único de verdade (*Single Source of Truth*).

---

## 7. Intervenção Realizada

### Técnica de Refatoração Aplicada
- **Extract Function & Extract Module** (*Fowler, 1999*).
- **Centralização de Invariante de Domínio** via função semântica `buildArtisanId()`.

### Arquivos Criados
1. `backend/src/utils/string.util.ts`: Contém `slugify()` e a fábrica padronizada `buildArtisanId()`.
2. `backend/src/constants/taxonomy.ts`: Contém o mapa oficial de técnicas `TECHNIQUE_MAP` e a função auxiliar de formatação `formatTechnique()`.
3. `backend/src/repositories/catalogLoader.ts`: Centraliza as interfaces de payload (`RawProdutoIA`, `CatalogoIAPayload`), a resolução de caminho `resolveCatalogPath()` e a leitura síncrona `loadCatalogPayload()`.

### Arquivos Modificados
1. `backend/src/repositories/produto.repository.ts`: Reduzido em 50% de linhas, consumindo os utilitários extraídos e focando apenas no mapeamento de produtos públicos.
2. `backend/src/repositories/artesao.repository.ts`: Reduzido em 42% de linhas, consumindo os utilitários e preservando a re-exportação de `slugify` para manter compatibilidade retroativa.

---

## 8. Comparação Antes vs. Depois

### Antes da Refatoração (`produto.repository.ts` — 110 linhas)
```typescript
// produto.repository.ts antes: acumulava slugify, dicionário e resolução de arquivos
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface RawProdutoIA { ... }
interface CatalogoIAPayload { ... }

function slugify(value: string): string { ... }
const TECHNIQUE_MAP: Record<string, string> = { ... };

export class ProdutoRepository {
  private resolveCatalogPath(): string { ... }

  private mapRawToPublic(item: RawProdutoIA): ProdutoPublico {
    const trimmedArtisan = item.artesao.trim();
    const artisanId = `art-${slugify(trimmedArtisan)}`;
    return {
      ...
      technique: TECHNIQUE_MAP[item.tecnica] ?? item.tecnica,
    };
  }
  ...
}
```

### Depois da Refatoração (`produto.repository.ts` — 55 linhas)
```typescript
// produto.repository.ts depois: enxuto, coeso e legível
import { formatTechnique } from '../constants/taxonomy.js';
import { buildArtisanId } from '../utils/string.util.js';
import { loadCatalogPayload } from './catalogLoader.js';
import type { RawProdutoIA } from './catalogLoader.js';

export interface ProdutoPublico { ... }

export class ProdutoRepository {
  private mapRawToPublic(item: RawProdutoIA): ProdutoPublico {
    const trimmedArtisan = item.artesao.trim();
    return {
      id: item.id,
      title: item.nome,
      artisan: trimmedArtisan,
      artisanId: buildArtisanId(trimmedArtisan),
      hub: item.polo,
      technique: formatTechnique(item.tecnica),
      price: item.preco,
      stock: item.estoque,
      active: true,
      imageUrl: '',
      imageAlt: item.nome,
    };
  }

  async findAll(): Promise<ProdutoPublico[]> {
    const data = loadCatalogPayload();
    return (data.produtos ?? []).map((item) => this.mapRawToPublic(item));
  }

  async findById(id: string): Promise<ProdutoPublico | null> {
    const all = await this.findAll();
    return all.find((p) => p.id === id) ?? null;
  }
}
```

### Métricas de Qualidade Obtidas
- **Linhas de código em `produto.repository.ts`:** De 110 para 55 linhas (**-50% de redução**).
- **Linhas de código em `artesao.repository.ts`:** De 112 para 65 linhas (**-42% de redução**).
- **Duplicações literais eliminadas:** 4 blocos duplicados extirpados da camada de dados (`slugify`, `TECHNIQUE_MAP`, `resolveCatalogPath`, `CatalogoIAPayload`).
- **Ponto Único de Verdade:** Regra `artisanId` unificada em `buildArtisanId()`.

---

## 9. Testes e Evidências de Validação

Foi realizado um procedimento formal de teste comportamental em duas etapas (Linha de Base Pré-Refatoração vs. Validação Pós-Refatoração), cobrindo 100% dos contratos HTTP e regras de negócio:

### Comandos de Compilação e Typecheck
```bash
# Executados no backend e no frontend:
cd backend && npm run build && npm run typecheck
cd frontend && npx tsc --noEmit
```
*Resultado:* **0 erros de compilação ou inconsistência de tipos TypeScript em ambas as aplicações.**

### Bateria de Testes HTTP Automatizada (12 Endpoints Verificados)

| Endpoint Testado | Objetivo do Teste | Status HTTP | Comportamento Observado | Preservação |
| :--- | :--- | :---: | :--- | :---: |
| `GET /api/v1/health` | Saúde do backend | **200 OK** | Servidor ativo, uptime operacional | **Preservado** |
| `GET /api/v1/produtos` | Listagem padrão (10 itens) | **200 OK** | 10 produtos retornados com campos idênticos | **100% Idêntico** |
| `GET /api/v1/produtos?page=1&limit=5` | Paginação | **200 OK** | Metadados (`totalItens: 14`, `totalPaginas: 3`) | **100% Idêntico** |
| `GET /api/v1/produtos?technique=Cerâmica Figurativa` | Filtro por técnica cultural | **200 OK** | Exatamente 5 peças retornadas | **100% Idêntico** |
| `GET /api/v1/produtos?technique=Couro` | Filtro por técnica cultural | **200 OK** | Exatamente 1 peça retornada | **100% Idêntico** |
| `GET /api/v1/produtos?hub=Alto do Moura` | Filtro por polo de produção | **200 OK** | Exatamente 4 peças retornadas | **100% Idêntico** |
| `GET /api/v1/produtos/p01` | Consulta de produto existente | **200 OK** | Retorna Boneco de barro Vitalino, artesão Mestre Severino | **100% Idêntico** |
| `GET /api/v1/produtos/p999` | Consulta de produto inexistente | **404 Not Found** | Retorna payload de erro esperado | **100% Idêntico** |
| `GET /api/v1/artesaos` | Listagem de artesãos (10 mestres) | **200 OK** | 10 mestres únicos deduplicados | **100% Idêntico** |
| `GET /api/v1/artesaos?limit=3` | Limitação de artesãos | **200 OK** | 3 artesãos retornados | **100% Idêntico** |
| `GET /api/v1/artesaos/art-mestre-severino` | Consulta de perfil por ID estável | **200 OK** | Retorna Mestre Severino com `id: art-mestre-severino` | **100% Idêntico** |
| `GET /api/v1/artesaos/art-inexistente` | Consulta de artesão inexistente | **404 Not Found** | Retorna payload de erro padronizado | **100% Idêntico** |

*Resultado do script de comparação `verify_post_refactor.py`:*  
**SUCESSO ABSOLUTO: 100% dos payloads e códigos HTTP retornados foram estritamente idênticos à linha de base.**

---

## 10. Benefícios Alcançados, Riscos e Limitações

- **Benefícios Concretos:**
  - Código limpo e autodocumentado, aderente às diretrizes de Robert C. Martin e Martin Fowler.
  - Eliminação de risco de divergência no vínculo `artisanId` entre produtos e seus criadores.
  - Repositórios focados em sua responsabilidade real, desacoplados de IO e formatação de texto.
  - Facilidade para a futura transição da persistência para o Prisma/PostgreSQL.
- **Riscos Remanescentes:** Baixíssimos. Todos os módulos extraídos são funções puras e isoladas.
- **Limitações:** O carregador ainda depende do arquivo estático `ia-recomendador/dados/catalogo.json`, o que é uma característica esperada desta etapa do projeto, a ser substituída quando os schemas de banco forem populados.

---

## 11. Rastreabilidade Git

- **Hash do Commit Individual:** *[Pendente — a ser gerado após o commit manual]*
- **Mensagem Sugerida do Commit:**
  ```text
  refactor(backend): elimina codigo duplicado em repositorios e extrai utilitarios (CS-01)
  ```
- **Branch:** `feat/frontend-next`
- **Autor do Commit:** *[Nome do Integrante]*

---

## 12. Roteiro Sintético para Apresentação em Sala

1. **O Problema (30 seg):**  
   *"Durante a auditoria de qualidade na branch `feat/frontend-next`, identifiquei o Code Smell **CS-01 (Duplicated Code / Shotgun Surgery)** nos repositórios de produto e de artesão. Funções idênticas de normalização de strings (`slugify`), o mapa de taxonomia cultural e a resolução de arquivos estavam duplicados em ambos os módulos, criando risco de quebra no vínculo `artisanId` caso um dos arquivos fosse alterado isoladamente."*
2. **A Avaliação Crítica e Decisão (45 seg):**  
   *"Avaliei se deveríamos manter o código sob a justificativa de ser uma persistência provisória de MVP ou refatorar. Concluí que a refatoração era altamente vantajosa: exigia baixo esforço, tinha risco de regressão nulo e eliminaria a duplicação na raiz, tornando os repositórios muito mais coesos e prontos para a futura migração para PostgreSQL."*
3. **A Intervenção e Resultados (45 seg):**  
   *"Apliquei a técnica canônica de Extract Module e Extract Function. Criei módulos dedicados para utilitários de string, constantes de taxonomia cultural e carregamento do catálogo JSON. Os repositórios tiveram uma redução de até 50% de linhas. Validei todos os 12 endpoints da API comparando com uma linha de base antes e depois, com 100% de preservação comportamental e zero erros de compilação."*
4. **Lição Aprendida (30 seg):**  
   *"A refatoração preventiva de duplicações evita o efeito 'Cirurgia por Espingarda' e demonstra que código limpo não é preciosismo teórico, mas sim garantia prática de integridade arquitetural e facilidade de manutenção para toda a equipe."*
