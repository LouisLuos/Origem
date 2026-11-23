# Origem: Frontend

Base de front-end do marketplace **Origem** (vitrine/home + Design System), construída com
**Next.js (App Router) + React + TypeScript + Tailwind CSS v4**.

## Rodando localmente

Requer **Node.js 20.9 ou superior**. Para apontar para outra API, copie `.env.example` para `.env.local`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção em .next/
npm run start    # serve o build em http://localhost:5173
npm run lint
```

## Deploy e Fake API

- **Frontend:** https://origem-five.vercel.app (Vercel).
- **Fake API:** https://origem-bnhv.onrender.com/api/v1 (Render). Serve `/produtos` e `/artesaos`
  e mantém os dados em memória: peças criadas pelo painel do artesão somem quando o serviço reinicia.
  No plano gratuito a primeira requisição após um período parado pode levar cerca de 1 minuto.
- O código da Fake API fica na branch `fake-api` deste repositório (pasta `fake_api/`); foi removido da `main` no commit `0b7e7f9`.
- A URL da API vem de `NEXT_PUBLIC_API_URL` (padrão: `http://localhost:3000/api/v1`). Ela é embutida no
  build, então alterar a variável na Vercel exige um novo deploy.

## Stack e por quê

- **Next.js + React + TypeScript**: rotas por arquivo em `src/app`, otimização de imagens e fontes,
  tipagem forte para os contratos de API que virão do backend (produtos, artesãos, pedidos). A porta
  fica em 5173 porque a padrão do Next (3000) é a da Fake API.
- **Tailwind CSS v4** (`@theme` em `src/styles/globals.css`): tokens de design (cor, tipografia,
  raio, sombra) definidos uma vez e usados tanto em classes utilitárias quanto em JS
  (`src/design-system/tokens.ts`) quando necessário.
- **lucide-react**: ícones leves em SVG, consistentes com o traço da marca.

O estado global fica em Context API (`src/context`) e os dados vêm de `src/services`, organizados por
domínio (catálogo, artesãos, pedidos, autenticação, carrinho, avaliações). Catálogo e artesãos
consomem a Fake API via `fetch`; os demais ainda usam simulação local (`localStorage`). Para trocar
pelo backend real, basta ajustar os services, sem mexer nas telas.

Sessão e carrinho vivem no `localStorage`, que não existe no servidor: os providers só os leem depois
da hidratação (flag `hydrated`). Telas que redirecionam ou preenchem formulários com esses dados ficam
atrás do `HydrationGate` no `page.tsx`. As telas ficam em `views/` porque `src/pages` é uma pasta
reservada do Next.

## Estrutura

```
src/
├── design-system/       # Design System puro (tokens + componentes reutilizáveis)
│   ├── tokens.ts
│   ├── cn.ts
│   └── components/       # Button, Badge, Chip, Input, ProductCard, SectionHeading, Container
├── components/           # Componentes de página (Header, Hero, seções da Home, Footer)
├── app/                  # Rotas do Next: layout, providers e um page.tsx por URL
├── views/                # Telas (Home, produto, artesão, carrinho, checkout, conta, painéis)
├── context/              # Estado global (auth, catálogo, carrinho, pedidos, favoritos, filtros)
├── services/             # Acesso a dados por domínio (Fake API, ViaCEP e simulações locais)
├── hooks/                # useResource (loading/erro/retry) e useCatalogAction
├── utils/                # Funções utilitárias
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

Ver seção "Próximos passos sugeridos" em [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).
