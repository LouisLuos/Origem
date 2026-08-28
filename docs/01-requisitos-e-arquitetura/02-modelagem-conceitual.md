# 📐 02. Modelagem Conceitual (UML)

### Projeto Integrador IV · Marketplace Origem
**Disciplina:** Requisitos, Projeto de Software e Validação (ADS020) · **Semestre:** 2026.2  
**Referência Metodológica:** Larman, Fowler, Visual Paradigm, OMG UML 2.5.1

---

## 1. O que é o Modelo Conceitual?

O **Modelo Conceitual** transforma o conhecimento estruturado da Análise de Domínio em representações formais e visuais verificáveis. Ele é agnóstico a decisões técnicas de implementação:

| O Modelo Conceitual Responde | O Modelo Conceitual NÃO Responde |
| :--- | :--- |
| • Quais conceitos existem no domínio e seus nomes oficiais.<br>• Quem interage com o sistema e qual valor obtém.<br>• Quais regras governam as relações antes de qualquer código.<br>• O que está dentro e fora da fronteira do escopo. | • Qual framework web, banco de dados ou linguagem usar.<br>• Qual o layout visual exato da tela.<br>• Como os endpoints REST e JSONs são formatados.<br>• Como as tabelas e índices físicos são organizados. |

---

## 2. Diagrama de Casos de Uso (Visão Comportamental)

O Diagrama de Casos de Uso descreve o sistema pela sua borda: os **atores**, suas **funções observáveis** e os **relacionamentos formais** (`<<include>>`, `<<extend>>` e `generalização`).

```mermaid
flowchart LR
    %% Atores
    Visitante((Visitante))
    Comprador((Comprador))
    Artesao((Artesão))
    Admin((Administrador))
    ServPagamento((<<sistema externo>><br/>Serviço de Pagamento))
    ServNotificacao((<<sistema externo>><br/>Serviço de Notificação))

    subgraph ORIGEM ["Fronteira do Sistema: ORIGEM"]
        %% Identidade e Acesso
        UC_Cadastrar["Cadastrar conta"]
        UC_Autenticar["Autenticar-se"]
        UC_RecuperarSenha["Recuperar senha"]
        UC_GerenciarPerfil["Gerenciar perfil"]

        %% Vitrine e Descoberta
        UC_Buscar["Buscar produtos"]
        UC_Filtrar["Filtrar produtos"]
        UC_FiltrarTecnica["Filtrar por técnica"]
        UC_FiltrarRegiao["Filtrar por região"]
        UC_FiltrarPreco["Filtrar por faixa de preço"]
        UC_VisualizarDetalhe["Visualizar detalhes da peça"]

        %% Carrinho e Checkout
        UC_GerenciarCarrinho["Gerenciar carrinho"]
        UC_FinalizarPedido["Finalizar pedido"]
        UC_ProcessarPagamento["Processar pagamento"]
        UC_AcompanharPedido["Acompanhar pedido"]
        UC_CancelarPedido["Cancelar pedido"]

        %% Pós-venda
        UC_AvaliarProduto["Avaliar produto"]
        UC_ConsultarHistorico["Consultar histórico de compras"]

        %% Ateliê do Artesão
        UC_PublicarProduto["Publicar produto"]
        UC_EnviarMidia["Enviar mídias do produto"]
        UC_EditarProduto["Editar produto"]
        UC_GerenciarEstoque["Gerenciar estoque"]
        UC_AcompanharVendas["Acompanhar vendas recebidas"]
        UC_AtualizarStatusEnvio["Atualizar status de envio"]

        %% Administração
        UC_ModerarPublicacao["Moderar publicação"]
        UC_ModerarArtesao["Moderar cadastro de artesão"]
        UC_VisualizarDashboard["Visualizar dashboard de indicadores"]
        UC_GerenciarCategorias["Gerenciar categorias e técnicas"]
        UC_ConsultarLogs["Consultar logs de auditoria"]

        %% IA e Inteligência
        UC_RecomendarProdutos["Recomendar produtos"]
        UC_ClassificarSentimento["Classificar sentimento de avaliação"]
    end

    %% Relações do Visitante (não autenticado)
    Visitante --> UC_Cadastrar
    Visitante --> UC_Autenticar
    Visitante --> UC_Buscar
    Visitante --> UC_RecuperarSenha

    %% Relações do Comprador
    Comprador --> UC_GerenciarPerfil
    Comprador --> UC_Buscar
    Comprador --> UC_VisualizarDetalhe
    Comprador --> UC_GerenciarCarrinho
    Comprador --> UC_FinalizarPedido
    Comprador --> UC_AcompanharPedido
    Comprador --> UC_CancelarPedido
    Comprador --> UC_AvaliarProduto
    Comprador --> UC_ConsultarHistorico

    %% Extensões de Filtro
    UC_Filtrar -.->|<<extend>>| UC_Buscar
    UC_FiltrarTecnica -->|generaliza| UC_Filtrar
    UC_FiltrarRegiao -->|generaliza| UC_Filtrar
    UC_FiltrarPreco -->|generaliza| UC_Filtrar

    %% Include no Checkout
    UC_FinalizarPedido -.->|<<include>>| UC_ProcessarPagamento
    UC_ProcessarPagamento --> ServPagamento
    UC_FinalizarPedido -.->|<<include>>| UC_GerenciarCarrinho

    %% Recomendação contextual
    UC_RecomendarProdutos -.->|<<extend>>| UC_VisualizarDetalhe
    UC_ClassificarSentimento -.->|<<extend>>| UC_AvaliarProduto

    %% Notificações
    UC_FinalizarPedido --> ServNotificacao
    UC_AtualizarStatusEnvio --> ServNotificacao

    %% Relações do Artesão
    Artesao --> UC_GerenciarPerfil
    Artesao --> UC_PublicarProduto
    Artesao --> UC_EditarProduto
    Artesao --> UC_GerenciarEstoque
    Artesao --> UC_AcompanharVendas
    Artesao --> UC_AtualizarStatusEnvio
    UC_PublicarProduto -.->|<<include>>| UC_EnviarMidia

    %% Relações do Admin
    Admin --> UC_ModerarPublicacao
    Admin --> UC_ModerarArtesao
    Admin --> UC_VisualizarDashboard
    Admin --> UC_GerenciarCategorias
    Admin --> UC_ConsultarLogs
```

### Especificação dos Casos de Uso

| Caso de Uso | Ator Principal | Relacionamento | Justificativa |
| :--- | :--- | :--- | :--- |
| **Cadastrar conta** | Visitante | Base | Ponto de entrada obrigatório; sem identidade não há operações autenticadas. |
| **Autenticar-se** | Visitante | Base | Geração de sessão/token para acesso às funcionalidades restritas por perfil (RBAC). |
| **Recuperar senha** | Visitante | Base | Fluxo de autosserviço para recuperação segura de acesso à conta. |
| **Gerenciar perfil** | Comprador / Artesão | Base | Atualização de dados pessoais, endereço, biografia (artesão) e preferências. |
| **Buscar produtos** | Visitante / Comprador | Base | Consulta textual livre no catálogo público da vitrine. |
| **Filtrar produtos** | Visitante / Comprador | `<<extend>>` Buscar | Refinamento opcional com critérios combinados (região, técnica, preço). |
| **Filtrar por técnica / região / preço** | Visitante / Comprador | Generalização de Filtrar | Especializações da filtragem com regras de domínio próprias. |
| **Visualizar detalhes da peça** | Comprador | Base | Acesso à ficha técnica, galeria, biografia do artesão e histórico de avaliações. |
| **Gerenciar carrinho** | Comprador | Base | Adição, remoção, atualização de quantidade e visualização resumida do carrinho temporário. |
| **Finalizar pedido** | Comprador | `<<include>>` Processar pagamento, Gerenciar carrinho | Fechamento transacional com reserva atômica de estoque de todos os itens do carrinho. |
| **Processar pagamento** | Serviço de Pagamento (ext.) | Incluído por Finalizar pedido | Liquidação simulada (Cartão/PIX) com retorno de aprovação ou recusa. |
| **Acompanhar pedido** | Comprador | Base | Visualização do status atualizado do pedido (*Confirmado → Em Preparação → Enviado → Entregue*). |
| **Cancelar pedido** | Comprador | Base | Solicitação de cancelamento dentro da janela permitida (antes do envio), com estorno de estoque. |
| **Avaliar produto** | Comprador | Base | Registro de nota (1–5) e comentário textual após recebimento confirmado. |
| **Consultar histórico de compras** | Comprador | Base | Listagem completa e paginada de todos os pedidos anteriores com respectivos status. |
| **Publicar produto** | Artesão | `<<include>>` Enviar mídias | Cadastro de nova peça com dados obrigatórios e mídias de evidência visual. |
| **Editar produto** | Artesão | Base | Alteração de dados, preço e mídias de um produto já publicado (resubmissão para moderação se necessário). |
| **Gerenciar estoque** | Artesão | Base | Atualização do saldo disponível de uma ou mais peças do ateliê. |
| **Acompanhar vendas recebidas** | Artesão | Base | Painel com pedidos recebidos, itens vendidos, faturamento acumulado e peças mais populares. |
| **Atualizar status de envio** | Artesão | Base | Transição de status logístico (*Em Preparação → Enviado → Entregue*) com notificação ao comprador. |
| **Moderar publicação** | Administrador | Base | Aprovação, recusa ou solicitação de ajuste de peças pendentes de curadoria. |
| **Moderar cadastro de artesão** | Administrador | Base | Validação de autenticidade do artesão (documentos, polo, técnica). |
| **Visualizar dashboard** | Administrador | Base | Métricas consolidadas: volume de vendas por polo, técnicas mais procuradas, ticket médio, artesãos ativos. |
| **Gerenciar categorias e técnicas** | Administrador | Base | CRUD de taxonomia oficial de técnicas artesanais e categorias de produtos. |
| **Consultar logs de auditoria** | Administrador | Base | Rastreamento de ações sensíveis (alterações de estoque, moderações, cancelamentos). |
| **Recomendar produtos** | Sistema (IA) | `<<extend>>` Visualizar detalhes | Sugestão automática de peças semelhantes por técnica, região ou comportamento de navegação. |
| **Classificar sentimento** | Sistema (IA) | `<<extend>>` Avaliar produto | Análise automática do texto do comentário para classificação de sentimento. |

---

## 3. Diagrama de Classes Conceitual (Estrutura Estática)

O Diagrama de Classes descreve os conceitos estáveis do negócio, seus atributos com tipos, suas operações e as regras de ciclo de vida (composição vs associação).

```mermaid
classDiagram
    direction TB

    class Usuario {
        <<abstract>>
        # id : UUID
        # nome : String
        # email : String
        # senhaHash : String
        # telefone : String
        # dataCadastro : DateTime
        # ativo : boolean
        + autenticar(email, senha) : Token
        + getIdentificacao() : String
        + desativarConta() : void
    }

    class Artesao {
        - biografia : String
        - poloOrigem : String
        - documentoCultural : String
        - statusHomologacao : String
        - fotoAtelie : String
        + publicar(p : Produto) : void
        + reputacaoMedia() : Decimal
        + totalVendas() : int
    }

    class Comprador {
        - cpf : String
        + avaliar(p : Produto, nota : int, comentario : String) : void
        + emitirPedido(c : Carrinho) : Pedido
    }

    class Endereco {
        - logradouro : String
        - numero : String
        - complemento : String
        - bairro : String
        - cidade : String
        - uf : String
        - cep : String
        + formatarCompleto() : String
    }

    class Tecnica {
        - nome : String
        - regiaoTipica : String
        - descricaoHistorica : String
        - ativa : boolean
        + listarProdutosAssociados() : List~Produto~
    }

    class Categoria {
        - nome : String
        - descricao : String
        - icone : String
        + quantidadeProdutosAtivos() : int
    }

    class Produto {
        - titulo : String
        - descricao : String
        - precoBase : Decimal
        - quantidadeEmEstoque : int
        - statusAprovacao : String
        - peso : Decimal
        - dimensoes : String
        - materiaPrima : String
        - tempoProducaoDias : int
        - dataCadastro : DateTime
        - versao : int
        + precoFinal() : Decimal
        + reservarEstoque(qtd : int) : boolean
        + liberarReserva(qtd : int) : void
        + confirmarBaixa(qtd : int) : void
        + notaMedia() : Decimal
        + estaDisponivel() : boolean
    }

    class Midia {
        - url : String
        - tipo : String
        - ordem : int
        - tamanhoBytes : long
        - altText : String
        + ehPrincipal() : boolean
    }

    class Carrinho {
        - dataCriacao : DateTime
        - dataExpiracao : DateTime
        + adicionarItem(p : Produto, qtd : int) : void
        + removerItem(p : Produto) : void
        + alterarQuantidade(p : Produto, qtd : int) : void
        + calcularTotal() : Decimal
        + limpar() : void
        + quantidadeItens() : int
        + estaVazio() : boolean
    }

    class ItemCarrinho {
        - quantidade : int
        - precoNoMomento : Decimal
        + subtotal() : Decimal
    }

    class Pedido {
        - numero : String
        - dataCriacao : DateTime
        - dataAtualizacao : DateTime
        - situacao : String
        - valorSubtotal : Decimal
        - valorFrete : Decimal
        - valorTotal : Decimal
        - observacoes : String
        + calcularTotal() : Decimal
        + confirmar() : void
        + cancelar(motivo : String) : void
        + atualizarStatus(novoStatus : String) : void
        + podeSerCancelado() : boolean
    }

    class ItemPedido {
        - quantidade : int
        - precoUnitario : Decimal
        + subtotal() : Decimal
    }

    class Pagamento {
        - metodo : String
        - valor : Decimal
        - status : String
        - codigoTransacao : String
        - dataProcessamento : DateTime
        + processar() : boolean
        + estornar() : void
    }

    class Avaliacao {
        - nota : int
        - comentario : String
        - data : DateTime
        - sentimento : String
        - moderada : boolean
        + podeSerEditada() : boolean
        + classificarSentimento() : String
    }

    class Notificacao {
        - tipo : String
        - titulo : String
        - mensagem : String
        - dataEnvio : DateTime
        - lida : boolean
        - canal : String
        + marcarComoLida() : void
    }

    class LogAuditoria {
        - acao : String
        - entidade : String
        - entidadeId : UUID
        - dadosAntes : String
        - dadosDepois : String
        - dataHora : DateTime
        - ipOrigem : String
        + descricaoLegivel() : String
    }

    %% ===== RELAÇÕES =====

    %% Generalização
    Usuario <|-- Artesao : Generalização (é um)
    Usuario <|-- Comprador : Generalização (é um)

    %% Composição forte
    Usuario "1" *-- "1..*" Endereco : possui
    Produto "1" *-- "1..*" Midia : composta por
    Pedido "1" *-- "1..*" ItemPedido : composto por
    Pedido "1" *-- "1" Pagamento : liquidado por
    Carrinho "1" *-- "0..*" ItemCarrinho : contém

    %% Associações de domínio
    Artesao "1" --> "0..*" Produto : publica
    Tecnica "1" <-- "0..*" Produto : emprega
    Categoria "1" <-- "0..*" Produto : classificado em
    Produto "1" o-- "0..*" Avaliacao : recebe
    Comprador "1" --> "0..*" Avaliacao : escreve

    Comprador "1" --> "0..1" Carrinho : mantém
    Comprador "1" --> "0..*" Pedido : realiza
    Pedido "1" --> "1" Endereco : entregue em
    ItemPedido "0..*" --> "1" Produto : referencia
    ItemCarrinho "0..*" --> "1" Produto : referencia

    %% Notificações e Auditoria
    Usuario "1" --> "0..*" Notificacao : recebe
    Usuario "1" --> "0..*" LogAuditoria : origina
```

### Relacionamentos e Ciclo de Vida:
* **Generalização (`Usuario` → `Artesao` e `Comprador`):** Especialização de perfil com atributos e comportamentos próprios.
* **Composição (`Pedido` ◆→ `ItemPedido` e `Pagamento`):** Se o pedido é destruído, seus itens e registro de pagamento desaparecem.
* **Composição (`Produto` ◆→ `Midia`):** Mídias pertencem exclusivamente ao ciclo de vida do produto.
* **Composição (`Carrinho` ◆→ `ItemCarrinho`):** O carrinho governa o ciclo de seus itens temporários.
* **Composição (`Usuario` ◆→ `Endereco`):** Endereços são parte integrante do perfil do usuário.
* **Agregação (`Produto` ◇→ `Avaliacao`):** Avaliações vinculam comprador e produto de forma independente; a remoção do produto não deveria destruir o histórico de avaliações pendentes de análise.
* **Associação (`Pedido` → `Endereco`):** O pedido referencia o endereço de entrega vigente no momento da compra (snapshot).
* **Associação (`Usuario` → `Notificacao` e `LogAuditoria`):** Rastreabilidade e comunicação assíncrona com o usuário.

---

## 4. Matriz de Coerência entre os Modelos (Verificação Cruzada)

> [!NOTE]
> **Critério de Consistência:** Todo caso de uso deve manipular ao menos uma classe do modelo, e toda classe deve participar de ao menos um caso de uso.

| Caso de Uso (Borda) | Classes Manipuladas (Interior) | Operações / Atributos Envolvidos |
| :--- | :--- | :--- |
| **Cadastrar conta** | `Usuario`, `Artesao` ou `Comprador`, `Endereco` | Instanciação de `Usuario` com especialização e composição de `Endereco`. |
| **Autenticar-se** | `Usuario` | `Usuario.autenticar()`, leitura de `senhaHash` e geração de token. |
| **Recuperar senha** | `Usuario`, `Notificacao` | Geração de token de recuperação e envio de `Notificacao` por e-mail. |
| **Gerenciar perfil** | `Usuario`, `Artesao`, `Comprador`, `Endereco` | Atualização de atributos pessoais e CRUD de endereços. |
| **Buscar produtos** | `Produto`, `Tecnica`, `Artesao`, `Categoria` | Leitura de `titulo`, `descricao`, `poloOrigem`, `Tecnica.nome`, `Categoria.nome`. |
| **Filtrar produtos (Técnica / Região / Preço)** | `Produto`, `Tecnica`, `Artesao`, `Categoria` | Filtragem combinada por múltiplos atributos. |
| **Visualizar detalhes da peça** | `Produto`, `Midia`, `Artesao`, `Tecnica`, `Avaliacao` | Leitura completa da ficha, galeria, biografia e nota média. |
| **Gerenciar carrinho** | `Carrinho`, `ItemCarrinho`, `Produto` | `adicionarItem()`, `removerItem()`, `alterarQuantidade()`, validação de `estaDisponivel()`. |
| **Finalizar pedido** | `Carrinho`, `Pedido`, `ItemPedido`, `Produto`, `Pagamento`, `Endereco`, `Notificacao`, `LogAuditoria` | Conversão de carrinho em pedido, `reservarEstoque()`, `confirmarBaixa()`, criação de `Pagamento`, disparo de `Notificacao`. |
| **Processar pagamento** | `Pagamento`, `Pedido` | `Pagamento.processar()`, atualização de `Pedido.situacao`. |
| **Acompanhar pedido** | `Pedido`, `ItemPedido` | Leitura de `situacao`, `dataAtualizacao` e itens associados. |
| **Cancelar pedido** | `Pedido`, `Produto`, `Pagamento`, `LogAuditoria` | `Pedido.cancelar()`, `Produto.liberarReserva()`, `Pagamento.estornar()`. |
| **Avaliar produto** | `Comprador`, `Produto`, `Avaliacao` | `Comprador.avaliar()`, instanciação de `Avaliacao`, cálculo de `notaMedia()`. |
| **Consultar histórico de compras** | `Comprador`, `Pedido`, `ItemPedido` | Listagem paginada de pedidos e seus itens. |
| **Publicar produto** | `Artesao`, `Produto`, `Midia`, `Tecnica`, `Categoria` | `Artesao.publicar()`, composição de `Midia`, vinculação de `Tecnica` e `Categoria`. |
| **Editar produto** | `Artesao`, `Produto`, `Midia`, `LogAuditoria` | Atualização de atributos, resubmissão de `statusAprovacao`, registro de auditoria. |
| **Gerenciar estoque** | `Artesao`, `Produto`, `LogAuditoria` | Atualização de `quantidadeEmEstoque` com registro de auditoria. |
| **Acompanhar vendas recebidas** | `Artesao`, `Pedido`, `ItemPedido`, `Produto` | Leitura de pedidos contendo itens do artesão, cálculo de `totalVendas()`. |
| **Atualizar status de envio** | `Artesao`, `Pedido`, `Notificacao` | `Pedido.atualizarStatus()`, disparo de `Notificacao` ao comprador. |
| **Moderar publicação** | `Produto`, `LogAuditoria` | Atualização de `statusAprovacao` com justificativa registrada. |
| **Moderar cadastro de artesão** | `Artesao`, `LogAuditoria` | Atualização de `statusHomologacao` com auditoria. |
| **Visualizar dashboard** | `Pedido`, `Produto`, `Artesao`, `Tecnica`, `Categoria` | Agregações: volume por polo, técnicas mais vendidas, ticket médio, artesãos ativos. |
| **Gerenciar categorias e técnicas** | `Categoria`, `Tecnica`, `LogAuditoria` | CRUD com auditoria de alterações na taxonomia oficial. |
| **Consultar logs de auditoria** | `LogAuditoria` | Leitura filtrada por período, ator, entidade e ação. |
| **Recomendar produtos** | `Produto`, `Tecnica`, `Artesao`, `Avaliacao` | Cálculo de similaridade por técnica, polo e padrão de navegação. |
| **Classificar sentimento** | `Avaliacao` | Processamento de NLP sobre `comentario`, atualização de `sentimento`. |

> [!TIP]
> **Cobertura total verificada:** Todas as 14 classes do modelo são manipuladas por ao menos um caso de uso, e todos os 27 casos de uso tocam ao menos uma classe.
