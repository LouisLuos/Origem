# Design System da Origem

Base visual do marketplace, construída a partir da identidade de marca (logo + paleta oficial)
e de 4 referências de marketplaces de arte/cerâmica (Bridge, East Fork, For Skin's Sake, Claymere).
Objetivo: transmitir **artesania, calor e cultura popular de Pernambuco** com uma interface limpa
o suficiente para vitrine de e-commerce.

## 1. Princípios

1. **Terroso, não genérico.** Evitamos cinza puro; neutros e sombras derivam da paleta de marca.
2. **Flat, sem border-radius.** Cantos retos em todos os componentes (botões, chips, cards, inputs),
   reforçando um caráter mais gráfico/editorial e afastando a interface do "template genérico" com tudo
   arredondado. O grid limpo em bento (referência Bridge/Claymere) ganha mais nitidez sem curvas.
3. **Uma única fonte, hierarquia por peso e tamanho.** `DM Sans` em tudo (títulos e corpo),
   sem serifada decorativa, sem uppercase/letter-spacing artificial imitando "template genérico de IA".
   Hierarquia vem de `font-weight`, tamanho e cor.
4. **Rótulos com função, não decoração.** Badge/caption só aparece quando carrega informação real
   (técnica + polo, "Oferta", nome de campanha). Nada de eyebrows genéricos tipo "Nossa origem" /
   "Vitrine" acima de todo título, nem estatísticas fabricadas sem fonte.
5. **Hover sutil, sem transform.** Mudança de cor/sombra em hover; sem `translate-y`/`scale` nos
   cards, evitando o efeito "flutuante" genérico de landing page gerada por IA.
6. **Acessível por padrão (RNF-07).** Contraste AA, foco visível, `alt` obrigatório, navegação por
   teclado e semântica HTML5 em todos os componentes: não é opcional, é parte do componente.

## 2. Tokens (`src/styles/globals.css` + `src/design-system/tokens.ts`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-creme` | `#EFE1CB` | Fundo geral, superfícies claras |
| `--color-terracota` | `#B34E24` | Cor primária de ação (CTAs, preços, destaques) |
| `--color-oliva` | `#5D6737` | Cor secundária (seções alternativas, sucesso sutil) |
| `--color-aubergine` | `#3F1B18` | Texto principal, header/footer escuros |
| `--color-surface` / `--color-surface-muted` | `#FFFDF9` / `#F7F1E5` | Cards e seções sobre o fundo creme |
| `--font-body` | `DM Sans` | Toda a UI, inclusive títulos (`h1` a `h4`) |
| `--shadow-soft` / `--shadow-lift` | (sem valor de token) | Sombra terrosa padrão / sombra em hover |

Todas as variações (50 a 700) de cada cor de marca foram derivadas para garantir contraste mínimo
4.5:1 em texto sobre fundo claro e escuro (WCAG 2.1 AA, conforme RNF-07).

## 3. Componentes (`src/design-system/components`)

| Componente | Papel |
| --- | --- |
| `Button` | CTA primário/secundário/outline/ghost, 3 tamanhos |
| `Badge` | Rótulo curto (ex.: "Oferta") |
| `Chip` | Filtro selecionável (técnica, categoria), com `aria-pressed` |
| `Input` | Campo de texto com `<label>` acessível obrigatório |
| `ProductCard` | Card de peça da vitrine: imagem, técnica + polo, artesão, preço, favoritar |
| `SectionHeading` | Cabeçalho de seção (título + descrição + ação) |
| `Container` | Largura máxima + padding responsivo padrão |

Componentes de página (Header, Hero, seções da Home) ficam em `src/components` e **compõem** o
Design System, não redefinem estilos soltos.

## 4. Convenções

- **Sem cinza puro.** Use `ink` / `ink-soft` (derivados da aubergine) em vez de `gray-*`.
- **Um único componente de imagem de produto.** Toda peça no catálogo usa `ProductCard`; não criar
  variantes ad-hoc por seção.
- **Ícones:** `lucide-react`, sempre com `aria-hidden="true"` quando decorativos, ou `aria-label`
  no elemento interativo pai quando funcionais (ex.: botão de favoritar).
- **Todo `<img>` tem `alt` descritivo** (não decorativo), obrigatório também no upload do artesão
  no produto real (RF-ART-01 / RNF-07).
- **Grid mobile-first:** breakpoints do Tailwind (`sm`, `md`, `lg`) cobrem os 3 breakpoints mínimos
  exigidos (< 640px, 640 a 1024px, > 1024px).

## 5. Próximos passos sugeridos

- Página de listagem/vitrine completa com filtros combinados (RF-CAT-02) usando `Chip` + `ProductCard`.
- Página de ficha técnica da peça (RF-CAT-03).
- Fluxo de carrinho/checkout (RF-CHK-01 a 04) reaproveitando `Button`, `Input`, `Badge`.
- Extrair tokens para um pacote compartilhado se o painel do artesão/admin virar app separado.
