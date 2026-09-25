# Roteiro do screencast (sem narração)

Duração estimada: 4–5 min. Cobre visão geral da aplicação, navegação entre telas e funcionamento do fluxo principal.

## Antes de gravar

- Abrir a URL do deploy em janela anônima, para o localStorage ficar limpo.
- Deixar a Fake API no ar.
- Contas demo: `artesao@origem.com` e `admin@origem.com`, ambas com a senha `origem123`.
- Zoom de 110–125%, gravação em 1080p e notificações desligadas.
- Pausas de 1–2 s em cada tela, para dar tempo de leitura.

## 1. Visão geral (~45 s)

1. Home: mostrar a barra de endereço com a URL do deploy.
2. Rolar a página: hero, carrossel de categorias, vitrine e `ArtisanSpotlight`, até o rodapé.
3. Reduzir a janela para mostrar o layout mobile e voltar ao desktop.

## 2. Navegação entre telas (~1 min 15 s)

1. Busca: digitar um termo no Header e deixar o dropdown de resultados aparecer.
2. Filtros: usar o filtro lateral (técnica, polo, preço) e mudar a ordenação.
3. Produto (`/produtos/:id`): mostrar galeria, detalhes e peças relacionadas; favoritar a peça.
4. Artesão (`/artesaos/:id`): abrir pelo link "Sobre o artesão" e mostrar bio e peças.
5. Favoritos (`/favoritos`): abrir pelo ícone do Header.
6. Digitar `/rota-inexistente` para mostrar o `NotFound`.
7. Acessar `/admin` sem login para mostrar o bloqueio da rota protegida.

## 3. Fluxo principal: compra (~1 min 45 s)

1. Adicionar 2 produtos ao carrinho.
2. Carrinho (`/carrinho`): alterar a quantidade, remover um item e mostrar o resumo (subtotal, frete e total).
3. Clicar em "Finalizar compra" e ir para `/entrar`; cadastrar uma conta de comprador.
4. Checkout: enviar o formulário vazio uma vez para mostrar a validação; preencher o endereço, escolher o pagamento (Pix) e confirmar.
5. Confirmação (`/pedido/:id`): deixar o número do pedido visível.
6. Conta (`/conta`): mostrar o pedido no histórico.

## 4. Painéis (~1 min)

1. Login como `artesao@origem.com` e abrir `/painel`.
2. Cadastrar uma peça, ajustar o estoque com +/− e pausar a peça.
3. Voltar à Home e mostrar que a peça pausada não aparece na vitrine.
4. Logout, entrar como `admin@origem.com` e abrir `/admin`.
5. Percorrer as abas Visão geral, Usuários, Pedidos e Catálogo.
