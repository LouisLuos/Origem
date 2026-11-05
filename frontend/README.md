# Origem: Frontend

Base de front-end do marketplace **Origem** (vitrine/home + Design System), construída com
**Next.js 15 (App Router) + React 18 + TypeScript + Tailwind CSS v4**.

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção via next build (.next/)
npm run lint     # validação ESLint
```

## Deploy e Fake API

- **Frontend:** https://origem-five.vercel.app (Vercel com Next.js).
- **Fake API:** https://origem-bnhv.onrender.com/api/v1 (Render). Serve `/produtos` e `/artesaos`
  e mantém os dados em memória: peças criadas pelo painel do artesão somem quando o serviço reinicia.
  No plano gratuito a primeira requisição após um período parado pode levar cerca de 1 minuto.
- O código da Fake API fica na branch `fake-api` deste repositório (pasta `fake_api/`); foi removido da `main` no commit `0b7e7f9`.
- A URL da API vem de `NEXT_PUBLIC_API_URL` ou `VITE_API_URL` (padrão: `http://localhost:3000/api/v1`). Ela é lida dinamicamente no runtime/build do Next.js.

## Stack e por quê

- **Next.js 15 + React 18 + TypeScript**: SSR rápido, App Router moderno, roteamento declarativo em diretórios (`src/app/`), tipagem forte para os contratos de API que virão do backend (produtos, artesãos, pedidos).
- **Tailwind CSS v4** (`@theme` em `src/app/globals.css`): tokens de design (cor, tipografia,
  raio, sombra) definidos uma vez e usados tanto em classes utilitárias quanto em JS
  (`src/design-system/tokens.ts`) quando necessário.
- **lucide-react**: ícones leves em SVG, consistentes com o traço da marca.

O estado global fica em Context API (`src/context`) envelopado no componente `Providers.tsx` (`"use client"`), com salvaguarda de hidratação SSR (`isMounted`). Os dados vêm de `src/services`, organizados por domínio (catálogo, artesãos, pedidos, autenticação, carrinho, avaliações). Catálogo e artesãos consomem a Fake API via `fetch`; os demais mantêm suporte via persistência local controlada (`storage.ts`).

## Estrutura

```
src/
├── app/                  # Next.js 15 App Router (rotas declarativas, layouts, metadados)
│   ├── layout.tsx        # Shell global com Providers, Header e Footer
│   ├── globals.css       # Tokens @theme do Tailwind v4
│   ├── not-found.tsx     # Página de erro 404 personalizada
│   ├── page.tsx          # Rota '/' (Home)
│   ├── produtos/[id]/    # Rota dinâmica '/produtos/:id'
│   ├── artesaos/[id]/    # Rota dinâmica '/artesaos/:id'
│   ├── carrinho/         # Rota '/carrinho'
│   ├── checkout/         # Rota '/checkout'
│   ├── pedido/[id]/      # Rota '/pedido/:id'
│   ├── favoritos/        # Rota '/favoritos'
│   ├── conta/            # Rota '/conta'
│   ├── entrar/           # Rota '/entrar'
│   ├── painel/           # Rota '/painel' (Artesão)
│   └── admin/            # Rota '/admin' (Administrador)
├── views/                # Telas e lógicas de apresentação das rotas (Account, Cart, etc.)
├── design-system/        # Design System puro (tokens + componentes sem border-radius)
│   ├── tokens.ts
│   ├── cn.ts
│   └── components/       # Button, Badge, Chip, Input, ProductCard, SectionHeading, Container
├── components/           # Componentes de seção (Providers, Header, Hero, Footer)
├── context/              # Estado global (auth, catálogo, carrinho, pedidos, favoritos, filtros)
├── services/             # Acesso a dados por domínio (API e storage SSR-safe)
├── hooks/                # useResource (loading/erro/retry)
└── utils/                # Funções utilitárias
```

Documentação completa do Design System (paleta terrosa, tipografia DM Sans, princípios, componentes): ver
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
