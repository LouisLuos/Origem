# Recomendador do Origem · AV2

## 1. Instalar e rodar

A HU-24 sugere peças afins à peça que o comprador abriu. O treino transforma 14 peças e 10 cestas sintéticas em um artefato local. O BentoML carrega esse artefato e atende às consultas por HTTP. Para reproduzir a entrega, use Python 3.11 e dois terminais PowerShell na raiz do repositório.

**Terminal 1.** Execute e aguarde a mensagem `Service Recomendador initialized`.

```powershell
cd ia-recomendador
py -3.11 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python treino.py
.\.venv\Scripts\bentoml serve service:Recomendador --host 127.0.0.1 --port 3001
```

**Terminal 2.** Entre na pasta e defina a função usada nos exemplos. O serviço também oferece documentação interativa em http://127.0.0.1:3001.

```powershell
cd ia-recomendador
function Recomendar($id) {
    Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3001/recomendar' -ContentType 'application/json' -Body (@{produto_id=$id} | ConvertTo-Json)
}
```

## 2. Mini dicionário de dados

O mock versionado contém duas coleções. [Catálogo e cestas](dados/catalogo.json)

| Campo | Significado no negócio |
|---|---|
| `produtos[].id` | Identificador da peça. Liga as consultas, recomendações e cestas ao mesmo produto. |
| `nome` | Título da peça apresentado ao comprador. |
| `artesao` | Ateliê fictício creditado pela produção. |
| `tecnica` | Técnica artesanal. Peças da mesma técnica podem ser sugeridas. |
| `polo` | Polo cultural da peça. Uma origem em comum também torna a peça candidata. |
| `categoria` | Finalidade da peça, como decoração ou vestuário. Entra no cálculo de similaridade. |
| `preco` | Valor em reais. O algoritmo compara faixas de preço (até 100, acima de 100 até 200 e acima de 200). |
| `estoque` | Unidades disponíveis. Uma candidata com estoque zero sai das sugestões. |
| `pedidos` | Total simulado de pedidos da peça, presente no catálogo. O ranking usa as cestas para calcular co-compra. |
| `cestas[]` | Cada lista reúne IDs de peças de uma compra simulada. Pares que aparecem juntos recebem um reforço na pontuação. |

## 3. Funções de acesso

A rota delega as consultas ao catálogo treinado. Cada função registra seus próprios retornos no log. [Acesso aos dados](acesso.py) · [Rotas HTTP](service.py) · [Algoritmo](recomendador.py)

| Função | Valor para o comprador | Resultado vazio ou erro |
|---|---|---|
| `buscar_peca` | Localiza a peça que o comprador abriu. | ID ausente gera `ProdutoInexistente`, registrado antes da resposta HTTP 404. |
| `buscar_afins` | Classifica as candidatas com estoque, da mesma técnica ou polo. Combina similaridade (60%) e co-compra (40%) e exclui a peça aberta. | Sem candidatas, devolve `items: []` com sucesso. |
| `listar_pecas` | Permite descobrir os IDs disponíveis via `POST /catalogo`. | Um catálogo vazio devolve `dados: []`. |

## 4. Gerar o log com três chamadas

No terminal 2, rode o bloco com o serviço em execução. Ele repete a primeira consulta e termina com a peça sem semelhantes. Cada chamada gera uma linha para a busca da peça e outra para a busca de afins.

```powershell
foreach ($id in 'p01','p01','p14') {
    $r = Recomendar $id
    "$id -> [$($r.items.product_id -join ', ')]"
}
Get-Content -Encoding UTF8 logs/uso.jsonl -Tail 6
```

Saída esperada, em ordem: `p01 → [p02, p04, p06, p05]`, outra resposta idêntica para `p01` e `p14 → []`. A última linha do log registra `buscar_afins`, origem `POST /recomendar`, alvo `p14`, quantidade zero e sucesso. Cada linha contém também o horário UTC, os parâmetros resumidos e os IDs devolvidos. O arquivo cresce a cada consulta. Uma execução completa está versionada para conferência. [Seis linhas obtidas via HTTP](evidencias/tres-chamadas.jsonl)

## 5. Ver o resumo e conferir o efeito de uma alteração

Para resumir todo o histórico, rode no terminal 2:

```powershell
.\.venv\Scripts\python resumo.py
```

Para comparar só as três chamadas que acabou de fazer, copie as últimas seis linhas e passe esse recorte ao script:

```powershell
Get-Content -Encoding UTF8 logs/uso.jsonl -Tail 6 | Set-Content -Encoding UTF8 logs/rodada.jsonl
.\.venv\Scripts\python resumo.py --log logs/rodada.jsonl
```

**Experimento de estoque.** No terminal 1, encerre o serviço com Ctrl+C. Execute o bloco abaixo para criar uma cópia do catálogo, zerar apenas o estoque de `p02` e carregar o novo modelo.

```powershell
$mock = Get-Content -Raw -Encoding UTF8 dados/catalogo.json | ConvertFrom-Json
($mock.produtos | Where-Object id -eq 'p02').estoque = 0
$mock | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 logs/catalogo-experimento.json
.\.venv\Scripts\python treino.py --catalogo logs/catalogo-experimento.json
.\.venv\Scripts\bentoml serve service:Recomendador --host 127.0.0.1 --port 3001
```

No terminal 2, execute `(Recomendar 'p01').items.product_id`. Antes, `p02` liderava as sugestões. Com estoque zero, restam `p04, p06, p05`. Para voltar ao modelo original, encerre o serviço, execute `.\.venv\Scripts\python treino.py` no terminal 1 e repita o comando de inicialização.

## 6. O que as três chamadas mostram

**(a)** A peça mais consultada diretamente foi `p01`, aberta duas vezes. **(b)** Oito peças nunca foram devolvidas pelas funções nessa rodada (`p03, p07, p08, p09, p10, p11, p12, p13`), pois a amostra cobre apenas dois alvos e suas sugestões. **(c)** Houve zero erros nas seis leituras: `p14` existe, mas é a única peça com sua técnica e seu polo, portanto sua lista de afins está corretamente vazia.

O resumo distingue aberturas de peças de retornos das funções. No ranking de retornos, `p01, p02, p04, p05, p06` empatam com duas ocorrências cada. Para demonstrar uma falha separadamente, execute `Recomendar 'p99'`: o HTTP retorna 404 e a próxima execução de `resumo.py` inclui um erro de peça inexistente. Os testes da HU-24 e da auditoria rodam com `.\.venv\Scripts\python -m pytest -q`.

## 7. Uso de IA generativa

O Codex auxiliou na adaptação do módulo da AV1, no registro e resumo das consultas, nos testes e na redação deste roteiro. O serviço calcula as recomendações com similaridade de cosseno e co-compra sobre o catálogo sintético.
