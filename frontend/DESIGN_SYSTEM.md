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
   Única exceção: `rounded-full` em elementos que são círculos por natureza (contador do carrinho,
   avatar, indicador de carregamento).
3. **Uma única fonte, hierarquia por peso e tamanho.** `DM Sans` em tudo (títulos e corpo),
   sem serifada decorativa. Hierarquia vem de `font-weight`, tamanho e cor. Maiúsculas com
   letras espaçadas existem em **um único lugar**: o `SectionTitle`, título pequeno de seção dentro
   de uma página (ex.: "MEUS PEDIDOS"). Nunca em títulos de página, botões, textos ou eyebrows
   decorativos acima de títulos.
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

Tudo é importado de `@/design-system`.

**Ações e navegação**

| Componente | Papel |
| --- | --- |
| `Button` | Ação: `primary` (uma por tela), `secondary`, `outline`, `ghost`, `light`; tamanhos `sm`, `md`, `lg` |
| `ButtonLink` | Navegação com a aparência de `Button` (use no lugar de `Link` envolvendo `Button`) |
| `Chip` | Filtro selecionável (técnica, categoria), com `aria-pressed` |
| `Tabs` | Abas acessíveis (setas, Home e End); use `tabPanelProps(idPrefix, id)` no painel de cada aba |

**Formulários**

| Componente | Papel |
| --- | --- |
| `Input` | Campo de texto com `<label>` obrigatório; props `hint` (ajuda) e `error` (erro do campo) |
| `Select` | Lista de opções com o mesmo visual do `Input`; mesmas props `hint` e `error` |
| `Textarea` | Texto longo (descrição, relato); mesmas props `hint` e `error` |
| `ChoiceCard` | Opção em cartão (rádio ou checkbox): forma de pagamento, endereço salvo, motivo |

**Estrutura e feedback**

| Componente | Papel |
| --- | --- |
| `Container` | Largura máxima + padding responsivo padrão |
| `SectionHeading` | Título **grande** de seção de vitrine/marketing (home, coleções) |
| `SectionTitle` | Título **pequeno** de seção dentro de uma página (pedidos, endereços, formulários) |
| `Panel` | Bloco com borda: `muted` (padrão) para formulários, `surface` para cartões de leitura |
| `Alert` | Aviso em caixa: `error`, `success`, `warning`, `info`; aceita `title` e `action` |
| `EmptyState` | Área sem conteúdo: ícone, título, explicação e próximo passo |
| `Badge` | Rótulo curto. Tons de marca (`terracota`, `oliva`, `aubergine`, `neutral`) para rótulos editoriais; `success`, `warning`, `danger` para status |
| `ProductCard` | Card de peça da vitrine: imagem, técnica + polo, artesão, preço, favoritar |

**Carregamento** (`src/components/AsyncState.tsx`): `LoadingBlock` (spinner com texto),
`ErrorBlock` (erro com "tentar novamente") e `ResourceGate` (escolhe entre os dois pelo status).

Componentes de página (Header, Hero, seções da Home, formulários de domínio) ficam em
`src/components` e **compõem** o Design System, não redefinem estilos soltos.

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

- **Erros de campo vão no campo** (`error` do `Input`/`Select`/`Textarea`); erros da operação
  inteira (falha ao salvar, sem conexão) vão num `Alert tone="error"` logo acima do botão de envio.
- **Status por cor, nunca só por cor.** O `Badge` de status sempre traz o texto do status;
  a cor apenas reforça.

## 5. Montando uma tela nova

### Estrutura da página

```tsx
<main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
  <Container>                           {/* formulário curto: <Container className="max-w-md"> */}
    <h1 className="pb-8 text-2xl font-semibold text-ink sm:text-3xl">Meus pedidos</h1>

    <section aria-labelledby="pedidos-title" className="flex flex-col gap-4">
      <SectionTitle id="pedidos-title" action={<Button size="sm" variant="outline">…</Button>}>
        Em andamento
      </SectionTitle>
      {/* conteúdo */}
    </section>
  </Container>
</main>
```

- Um único `h1` por página; seções internas usam `SectionTitle` (`h2`, ou `h3` dentro de um `Panel`).
- `id="main-content"` no `<main>` (alvo do link "pular para o conteúdo").
- Espaçamento entre seções: `pt-10`; entre itens de uma lista: `gap-3` ou `gap-4`.
- Grade de duas colunas (conteúdo + resumo lateral): `grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14`.

### Os quatro estados de toda tela com dados

Toda tela que carrega dados do servidor precisa desenhar os quatro estados:

| Estado | Como mostrar |
| --- | --- |
| Carregando | `LoadingBlock` (ou `ResourceGate`) |
| Erro ao carregar | `ErrorBlock` com "tentar novamente", ou `Alert tone="error"` com `action` |
| Vazio | `EmptyState` com o próximo passo (ex.: "Ver vitrine") |
| Com dados | O conteúdo, em `Panel tone="surface"` ou lista de cartões |

E toda ação (salvar, remover, enviar) mostra: botão desabilitado com `aria-busy` e texto
"Salvando…" durante o envio, e um `Alert` de sucesso ou erro no fim. Ações destrutivas pedem
confirmação na própria linha ("Remover este endereço? [Remover] [Cancelar]").

### Formulários

```tsx
<Panel as="form" onSubmit={handleSubmit} noValidate aria-labelledby="form-title">
  <SectionTitle as="h3" id="form-title" description="Explique em uma frase para que serve.">
    Registrar avaria
  </SectionTitle>
  <div className="grid gap-4 sm:grid-cols-2">
    <Select label="Motivo" error={errors.motivo}>…</Select>
    <Input label="Data do recebimento" type="date" error={errors.data} />
  </div>
  <Textarea label="Descreva o problema" hint="Mínimo de 20 caracteres." error={errors.descricao} />
  {submitError && <Alert tone="error">{submitError}</Alert>}
  <div className="flex flex-wrap gap-2">
    <Button type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Enviando…' : 'Enviar'}</Button>
    <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
  </div>
</Panel>
```

### Status com `Badge`

| Situação | Tom |
| --- | --- |
| Concluído, aprovado, entregue | `success` |
| Precisa de atenção, prazo próximo, em análise | `warning` |
| Cancelado, recusado, falhou, atrasado | `danger` |
| Aguardando, rascunho, informativo | `neutral` |

O mapeamento de cada status de domínio para um tom fica junto da tela que o exibe,
num objeto `Record<Status, { label: string; tone: BadgeTone }>`, nunca espalhado no JSX.

## 6. Próximos passos sugeridos

- Migrar as telas existentes para `Select`, `Textarea`, `Alert`, `EmptyState`, `Panel` e
  `SectionTitle` à medida que forem alteradas (hoje elas repetem essas classes à mão).
- Extrair tokens para um pacote compartilhado se o painel do artesão/admin virar app separado.
