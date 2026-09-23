# Origem: Frontend

Base de front-end do marketplace **Origem** (vitrine/home + Design System), construída com
**React + TypeScript + Vite + Tailwind CSS v4**.

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção em dist/
npm run lint
```

## Stack e por quê

- **Vite + React + TypeScript**: build rápido, DX simples, tipagem forte para os contratos de API
  que virão do backend (produtos, artesãos, pedidos).
- **Tailwind CSS v4** (`@theme` em `src/styles/globals.css`): tokens de design (cor, tipografia,
  raio, sombra) definidos uma vez e usados tanto em classes utilitárias quanto em JS
  (`src/design-system/tokens.ts`) quando necessário.
- **lucide-react**: ícones leves em SVG, consistentes com o traço da marca.

Sem framework de estado global por enquanto: a Home é estática (dados mock em `src/data`). Quando a
API entrar, o ponto de integração é substituir `src/data/mockProducts.ts` / `mockArtisans.ts` por
chamadas reais (`GET /produtos`, `GET /artesaos`), mantendo os componentes iguais.

## Estrutura

```
src/
├── design-system/       # Design System puro (tokens + componentes reutilizáveis)
│   ├── tokens.ts
│   ├── cn.ts
│   └── components/       # Button, Badge, Chip, Input, ProductCard, SectionHeading, Container
├── components/           # Componentes de página (Header, Hero, seções da Home, Footer)
├── pages/
│   └── Home.tsx           # Vitrine principal
├── data/                 # Dados mock para desenvolvimento visual
├── styles/globals.css     # Tokens de tema (@theme) + estilos base
└── assets/                # Logo e referências de identidade visual
```

Documentação completa do Design System (paleta, tipografia, princípios, componentes): ver
[`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

## Acessibilidade e qualidade (RNF-07)

- Skip link, `focus-visible` global, `aria-label`/`aria-pressed` em botões icônicos, `<label>`
  obrigatório em inputs, `alt` descritivo em toda imagem, hierarquia semântica (`header`, `nav`,
  `main`, `section`, `footer`).
- Grid mobile-first com os 3 breakpoints mínimos do RNF-07 (mobile / tablet / desktop).
- Meta antes de shippar uma tela nova: rodar Lighthouse (Performance/Acessibilidade/Boas práticas ≥ 90).

## Próximos passos

Ver seção "Próximos passos sugeridos" em [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md): página de
listagem com filtros, ficha técnica da peça, carrinho/checkout.
