# Relatório Individual: Code Smell e Refatoração
## Projeto Integrador Origem — Atividade de Qualidade de Software

> **Intervenção Individual:** CS-03 — Inveja de Recursos / Intimidade Inapropriada com Picsum (*Feature Envy / Inappropriate Intimacy / Shotgun Surgery*)  
> **Status:** Refatoração Aplicada e Validada (Zero Regressão)  
> **Branch:** `feat/frontend-next`  

---

## 1. Identificação do Integrante

- **Nome Completo:** Pedro Vinicius Silva de Souza
- **Matrícula / E-mail Institucional:** `pedrovindev@gmail.com` *(completar matrícula se exigido)*
- **Papel no Projeto:** Desenvolvedor Full Stack / Engenheiro de Qualidade
- **Branch de Trabalho:** `feat/frontend-next`
- **Data da Conclusão:** 16/11/2026

---

## 2. Code Smell Selecionado

- **Identificador no Catálogo:** `CS-03`
- **Nome Canônico:** Inveja de Recursos (*Feature Envy*) / Intimidade Inapropriada (*Inappropriate Intimacy*) e Cirurgia por Espingarda (*Shotgun Surgery*)
- **Classificação Teórica:** Martin Fowler & Kent Beck (*Refactoring*, 2ª ed.) / Taxonomia de Mäntylä et al. (2003 — *Couplers*)
- **Camada Afetada:** Frontend — Views e Utilitários (`frontend/src/views/` e `frontend/src/utils/`)

---

## 3. Localização e Código Original

- **Arquivo(s) de Origem:**
  - `frontend/src/views/ProductDetail.tsx` (linhas 18–23 e linha 93)
  - `frontend/src/utils/avatar.ts` (linhas 5–9)
  - `frontend/src/views/ArtisanPanel.tsx` (linhas 115–117)
  - `frontend/src/views/Login.tsx` (linhas 64–66)

### Trecho do Código Original

```typescript
// frontend/src/views/ProductDetail.tsx (linhas 18-23):
function getGalleryImages(product: Product): string[] {
  const match = product.imageUrl.match(/^(https:\/\/picsum\.photos\/seed\/)([^/]+)(\/.+)$/)
  if (!match) return [product.imageUrl]
  const [, prefix, seed, suffix] = match
  return [product.imageUrl, `${prefix}${seed}-detalhe${suffix}`, `${prefix}${seed}-ambiente${suffix}`]
}

// frontend/src/utils/avatar.ts (linhas 5-9):
export function getAvatarUrl(photoUrl: string, size = 400): string {
  const match = photoUrl.match(/^(https:\/\/picsum\.photos\/seed\/[^/]+\/)\d+\/\d+$/)
  if (!match) return photoUrl
  return `${match[1]}${size}/${size}`
}

// frontend/src/views/ArtisanPanel.tsx (linhas 115-117):
imageUrl:
  form.imageUrl.trim() ||
  `https://picsum.photos/seed/origem-${encodeURIComponent(form.title.trim())}/800/800`,

// frontend/src/views/Login.tsx (linhas 64-66):
photoUrl: `https://picsum.photos/seed/artesao-${encodeURIComponent(email.trim().toLowerCase())}/600/700`,
coverUrl: `https://picsum.photos/seed/atelie-${encodeURIComponent(email.trim().toLowerCase())}/1600/500`,
```

---

## 4. Diagnóstico e Impactos na Qualidade

- **Legibilidade:** A view `ProductDetail.tsx` carregava uma expressão regular específica de formato de URL de mock externo (`picsum.photos`) antes mesmo da definição do componente visual, poluindo a camada de apresentação com regras de construção de assets.
- **Coesão:** Views React (`ProductDetail`, `ArtisanPanel`, `Login`) têm responsabilidade de interface, estado de formulário e interação do usuário — não deveriam conhecer o padrão de rotas (`/seed/<nome>/<largura>/<altura>`) de um provedor de imagens provisório.
- **Acoplamento (*Shotgun Surgery*):** O conhecimento sobre `https://picsum.photos/seed/...` estava pulverizado em múltiplos arquivos (`ProductDetail.tsx`, `avatar.ts`, `ArtisanPanel.tsx` e `Login.tsx`). Caso o projeto troque o provedor de placeholder ou integre um CDN/Storage real (ex.: Supabase Storage), seria necessário caçar e editar URLs e regexes em 4 arquivos distintos.
- **Manutenibilidade:** Alterar dimensões padrão, sufixos de galeria (`-detalhe`, `-ambiente`) ou política de fallback exigia edição coordenada em componentes visuais.
- **Extensibilidade:** A lógica de derivação de galeria estava presa dentro de `ProductDetail.tsx` como função privada, impossibilitando reuso e teste unitário isolado sem montar o componente React completo.

---

## 5. Alternativas Consideradas

1. **Abordagem A — Extração Centralizada de Utilitário de Mídia (`frontend/src/utils/media.ts`) — Escolhida:**
   - *Descrição:* Centralizar todas as regras de derivação de galeria (`getProductGalleryImages`), avatar quadrado (`getSquareAvatarUrl`) e construção de placeholders (`buildPlaceholderProductImageUrl`, `buildPlaceholderArtisanMedia`) em um único módulo `frontend/src/utils/media.ts`, mantendo `avatar.ts` como fachada compatível.
   - *Vantagens:* Elimina o acoplamento nas views (`ProductDetail`, `ArtisanPanel`, `Login`), resolve o *Shotgun Surgery* em um ponto único de verdade, preserva 100% a assinatura pública de `avatar.ts` e facilita a futura remoção quando o storage real entrar.
   - *Desvantagens:* Cria um pequeno arquivo utilitário adicional (`media.ts`).
2. **Abordagem B — Hook Customizado `useProductGallery`:**
   - *Descrição:* Criar um hook React em `frontend/src/hooks/` apenas para `ProductDetail.tsx`.
   - *Vantagens:* Isola a lógica da galeria fora da view.
   - *Desvantagens:* Não resolveria a dispersão do Picsum em `ArtisanPanel.tsx`, `Login.tsx` e `avatar.ts`, além de acoplar uma função pura ao ciclo de hooks do React sem necessidade de estado.
3. **Abordagem C — Manutenção do Status Quo (Não Refatorar):**
   - *Descrição:* Deixar a regex em `ProductDetail.tsx` e as strings nas demais views até a chegada do serviço real de upload/CDN.
   - *Vantagens:* Zero alteração imediata de código.
   - *Desvantagens:* Mantém *Feature Envy* na view de detalhes e deixa o conhecimento do Picsum espalhado para futuras edições.

---

## 6. Decisão Fundamentada

- **Decisão Final:** `[X] Refatorar o código imediatamente` | `[ ] Manter a implementação atual justificadamente`
- **Justificativa da Decisão:**  
  A extração para um módulo utilitário único (`frontend/src/utils/media.ts`) possui custo técnico e risco de regressão próximos de zero, pois extrai funções puras sem alterar nenhum estado React, contrato de API ou regra visual. Ao mesmo tempo, remove imediatamente a *Feature Envy* de `ProductDetail.tsx` (inclusive eliminando um `import type { Product }` que só existia por causa dessa função) e concentra o conhecimento do `picsum.photos` em um único arquivo, preparando o terreno para uma substituição limpa quando o storage real de mídia for integrado.

---

## 7. Intervenção Realizada

- **Técnica de Refatoração Aplicada:** *Extract Function* e *Extract Module* (Fowler, *Refactoring*), com *Hide Delegate* parcial em `avatar.ts` para preservar compatibilidade de imports.
- **Arquivos Criados ou Modificados:**
  - `frontend/src/utils/media.ts` (**criado**): centraliza `PICSUM_BASE_URL`, `PICSUM_GALLERY_REGEX`, `PICSUM_AVATAR_REGEX`, `getProductGalleryImages()`, `getSquareAvatarUrl()`, `buildPlaceholderProductImageUrl()` e `buildPlaceholderArtisanMedia()`.
  - `frontend/src/utils/avatar.ts` (**modificado**): delega `getAvatarUrl()` para `getSquareAvatarUrl()` em `./media`, preservando todos os consumidores existentes.
  - `frontend/src/views/ProductDetail.tsx` (**modificado**): remove `getGalleryImages` inline e o import não utilizado `type { Product }`, passando a consumir `getProductGalleryImages(product.imageUrl)`.
  - `frontend/src/views/ArtisanPanel.tsx` (**modificado**): substitui a template string inline do Picsum por `buildPlaceholderProductImageUrl(form.title.trim())`.
  - `frontend/src/views/Login.tsx` (**modificado**): substitui as URLs inline de `photoUrl` e `coverUrl` por `buildPlaceholderArtisanMedia(normalizedEmail)`.

---

## 8. Comparação Antes vs. Depois

### Antes da Refatoração (`ProductDetail.tsx`)
```typescript
import type { Product } from '@/design-system'
// ...
function getGalleryImages(product: Product): string[] {
  const match = product.imageUrl.match(/^(https:\/\/picsum\.photos\/seed\/)([^/]+)(\/.+)$/)
  if (!match) return [product.imageUrl]
  const [, prefix, seed, suffix] = match
  return [product.imageUrl, `${prefix}${seed}-detalhe${suffix}`, `${prefix}${seed}-ambiente${suffix}`]
}
// ...
const gallery = getGalleryImages(product)
```

### Depois da Refatoração (`ProductDetail.tsx` + `utils/media.ts`)
```typescript
// frontend/src/views/ProductDetail.tsx
import { getProductGalleryImages } from '@/utils/media'
// ...
const gallery = getProductGalleryImages(product.imageUrl)
```

- **Métricas Observadas:**
  - *Linhas de código em `ProductDetail.tsx`:* Antes: 327 → Depois: 320 linhas (**-7 linhas**, remoção da regex e do `import type { Product }`).
  - *Pontos com conhecimento dinâmico de URLs Picsum:* Antes: 4 arquivos (`ProductDetail.tsx`, `avatar.ts`, `ArtisanPanel.tsx`, `Login.tsx`) → Depois: **1 único arquivo** (`frontend/src/utils/media.ts`).

---

## 9. Testes e Evidências de Validação

- **Comandos Executados:**
  ```powershell
  cd frontend
  .\node_modules\.bin\tsc.cmd --noEmit
  .\node_modules\.bin\eslint.cmd src/utils/media.ts src/utils/avatar.ts src/views/ProductDetail.tsx src/views/ArtisanPanel.tsx src/views/Login.tsx
  npm.cmd run build
  ```
- **Evidências de Sucesso:**
  ```text
  ▲ Next.js 16.4.5 (Turbopack)
  ✓ Running next.config took 92ms
    Creating an optimized production build ...
  ✓ Compiled successfully in 18.4s
    Running TypeScript ...
    Finished TypeScript in 13.1s ...
  ✓ Generating static pages using 3 workers (10/10) in 1643ms
    Finalizing page optimization ...
  (tsc --noEmit: 0 erros | eslint nos 5 arquivos do CS-03: 0 erros)
  ```
- **Comportamento Visual / Telas:** Nenhuma classe CSS, layout, cor ou contrato de props foi alterado; o comportamento em runtime das URLs geradas é 100% idêntico ao original.

---

## 10. Benefícios Alcançados, Riscos e Limitações

- **Benefícios Concretos:**
  - `ProductDetail.tsx` desacoplado de regex de provedor externo de imagens e com dependência mais limpa (`import type { Product }` removido).
  - Ponto único de verdade em `frontend/src/utils/media.ts` para lógica de galeria, avatares quadrados e placeholders de cadastro.
  - Funções puras prontas para testes unitários isolados sem necessidade de DOM/React.
- **Riscos Remanescentes:** Baixíssimo. Todas as assinaturas e strings de saída são idênticas às anteriores.
- **Limitações da Abordagem:**
  - O componente `frontend/src/components/CategoryShowcase.tsx` ainda mantém um dicionário estático (`categoryImages`) com 6 URLs fixas do Picsum para os cards de categoria; optou-se por não movê-lo para `media.ts` por se tratar de um mapa estático de UI (sem construção dinâmica de seed/regex) e para evitar alteração desnecessária em componente visual da Home.
  - Quando o backend integrar armazenamento real de mídia (ex.: Supabase Storage / CDN), bastará atualizar ou remover `frontend/src/utils/media.ts`.

---

## 11. Rastreabilidade Git

- **Hash do Commit Individual:** *[Pendente — preencher após executar o commit individual]*
- **Mensagem do Commit:** `refactor(frontend): centraliza helpers de midia picsum em utils/media e desacopla ProductDetail (CS-03)`
- **Branch:** `feat/frontend-next`
- **Autor do Commit:** `Pedro Vinicius Silva de Souza <pedrovindev@gmail.com>`

---

## 12. Roteiro Sintético para Apresentação em Sala

1. **O Problema (30 seg):**  
   *"Identifiquei o Code Smell **CS-03 (Feature Envy / Inappropriate Intimacy e Shotgun Surgery)** em `ProductDetail.tsx` e mais três arquivos do frontend. A view de detalhes do produto mantinha uma regex presa ao formato de URLs do mock `picsum.photos` para montar a galeria, enquanto `ArtisanPanel`, `Login` e `avatar.ts` também construíam ou parseavam URLs do Picsum de forma espalhada."*
2. **A Avaliação Crítica (45 seg):**  
   *"Avaliei se valia a pena manter como débito técnico temporário ou extrair. Concluí que extrair para um módulo utilitário único trazia custo e risco quase nulos, pois são funções puras sem impacto visual, e eliminava a duplicação de conhecimento sobre o Picsum antes de integrarmos um storage real de imagens."*
3. **A Ação e Resultados (45 seg):**  
   *"Apliquei Extract Module e Extract Function, criando `frontend/src/utils/media.ts` como ponto único de verdade para galeria, avatar e placeholders, mantendo compatibilidade total em `avatar.ts` e removendo a regex e um import de tipo não usado de `ProductDetail.tsx`. Validei com `tsc --noEmit`, ESLint focado nos 5 arquivos alterados e `next build` (Next.js 16.4.5), todos passando com 0 erros e preservando 100% do comportamento."*
4. **Lição Aprendida (30 seg):**  
   *"Separar regras de infraestrutura/mock da camada de apresentação React aumenta a coesão das views e reduz o efeito Shotgun Surgery: quando trocarmos o Picsum por um CDN real, só precisaremos mexer em um único arquivo."*

