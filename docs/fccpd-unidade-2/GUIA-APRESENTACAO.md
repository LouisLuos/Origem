# Guia de estudo e apresentação oral · Origem

**FCCPD Unidade 2 · branch `feat/fccpd-u2-fastapi`**

Imagine que alguém abriu o **Boneco de barro Vitalino**. Como escolher outras quatro peças para mostrar? E se tivéssemos que fazer essa escolha para **cada uma de 500 peças**? A primeira pergunta explica a vitrine. A segunda explica por que existe um laboratório. Use as duas para conduzir a apresentação.

## 1. Entendendo a atividade

| Critério | Pergunta da professora, em linguagem simples | Como responder com uma demonstração |
|---|---|---|
| Arquitetura distribuída · **40 pontos** | Quais programas trabalham juntos? Por que vocês os separaram? Como sei que um realmente chama o outro? | Desenhe o caminho de uma recomendação. Abra uma peça, mostre a requisição e localize as chamadas internas no log. |
| Paralelismo com ganho · **35 pontos** | Que trabalho pode acontecer ao mesmo tempo? Isso economizou tempo? | Mostre a divisão do lote no código e compare sequencial e paralelo para 500 produtos, com o mesmo resultado. |
| Avaliação de desempenho · **25 pontos** | Como vocês mediram? O que concluem e em quais condições? | Explique o aquecimento, leia as medianas e compare o acervo pequeno com o catálogo sintético. Separe tempo de cálculo e tempo percebido no navegador. |

**O que a rubrica pede** é uma arquitetura explicada, paralelismo implementado com ganho medido e uma avaliação que sustente a conclusão. **Escolhas do Origem para demonstrar isso** incluem a página de laboratório, os gráficos, a expansão sintética reproduzível, a comparação por SHA-256 e as capturas salvas. Cada recurso ajuda a responder uma pergunta da rubrica. [Documentação técnica e evidências](arquitetura-e-benchmark.md)

## 2. Entendendo nosso projeto

Um **serviço** é um programa que recebe pedidos e devolve respostas. Uma **porta** identifica onde ele está escutando. Uma **API** define como fazer o pedido e qual resposta esperar. Na demonstração, os programas rodam na mesma máquina; cada serviço FastAPI tem seu próprio processo e endereço HTTP.

Nesta branch, reaproveitamos o frontend Next.js do marketplace e substituímos o backend Express/Prisma por dois serviços Python. Python permite escrever a regra de pontuação e executar partes dela em processos separados com a biblioteca padrão. FastAPI fornece as rotas HTTP e a validação dos parâmetros. São escolhas que atendem a duas necessidades diferentes: oferecer uma API e repartir um cálculo. Quem executa o trabalho em paralelo é o pool de processos.

~~~mermaid
flowchart LR
    U["Navegador"] -->|abre a peça| F["Next.js · 5173"]
    F -->|GET recomendações| C["Catalog Service · 3001"]
    C -->|POST /recommendations| R["Recommendation Service · 3002"]
    R -->|GET produtos e cestas| C
    C -->|consulta| D["JSON local e PostgreSQL em leitura"]
    R -->|modo paralelo| P["Pool de processos"]
~~~

**Por que dois serviços?** O Catalog sabe **quais peças existem**, quem as produz, quanto custam e quais estão disponíveis. Ele centraliza a leitura do PostgreSQL e do catálogo local. O Recommendation sabe **como comparar peças**. Ele recebe os dados por HTTP, calcula a classificação e pode usar mais CPU. Essa fronteira permite mudar ou dimensionar o cálculo separadamente. O custo da separação aparece nas chamadas HTTP e na dependência de ambos os serviços para obter recomendações. [Repositório de dados](../../services/catalog-service/app/repository.py) · [Cliente HTTP do Recommendation](../../services/recommendation-service/app/catalog_client.py)

**Acompanhe uma peça, passo a passo.**

1. Abra [o produto p01](http://localhost:5173/produtos/p01). Ao carregar a peça, a seção **Você também pode gostar** já pede recomendações. Trocar o modo ou a quantidade de workers dispara outro pedido.
2. O navegador chama `GET /api/v1/produtos/p01/recomendacoes` no próprio domínio do frontend, com limite e modo. O rewrite do Next encaminha o pedido ao Catalog na porta 3001.
3. O Catalog confirma que a peça existe e envia `POST /recommendations` à porta 3002, com o ID e os parâmetros da recomendação.
4. Para pontuar as candidatas, o Recommendation pede ao Catalog a lista de produtos e as **cestas**, grupos de IDs de peças que aparecem juntas. As duas leituras HTTP podem esperar respostas ao mesmo tempo. Elas consultam endpoints de dados, portanto o fluxo termina sem voltar a solicitar recomendações.
5. O Recommendation devolve a ordem, as pontuações, os motivos e as métricas. O Catalog acrescenta os dados usados nos cartões, como imagem e estoque. O Next entrega a resposta ao navegador.
6. Para comprovar o percurso, a aba **Rede/Network** mostra o pedido do navegador ao Next. O log dos servidores registra o POST ao Recommendation e os GETs de volta ao Catalog. São dois pontos de observação do mesmo fluxo. [Detalhe da peça](../../frontend/src/views/ProductDetail.tsx) · [Rewrite](../../frontend/next.config.ts) · [Log HTTP](../../benchmarks/results/http_communication.log)

## 3. Entendendo o paralelismo

**Sequencial** significa percorrer o trabalho em ordem. No lote, o motor calcula as sugestões da primeira peça, depois as da segunda e assim por diante. **Paralelo** significa que partes independentes desse trabalho podem ser executadas simultaneamente. A classificação de uma peça depende do catálogo e das cestas; ela pode ser calculada sem aguardar a classificação da peça anterior.

### Primeiro, aprenda a recomendar uma peça

Pense em `p01`, o boneco Vitalino do Alto do Moura. `p02`, a cena de forró em barro, tem a mesma técnica e o mesmo polo. Ela pode entrar na disputa. `p03`, o vaso de barro pintado, também combina com o alvo, mas seu estoque no catálogo local é zero. O motor a descarta. Este trecho é o filtro real de candidatas. [Peças do acervo local](../../services/catalog-service/data/catalogo.json) · [Motor, função `_score_candidates_chunk`](../../services/recommendation-service/app/engine.py)

~~~python
if pid == target_id or p["estoque"] <= 0 or not (mesma_tecnica or mesmo_polo):
    continue
~~~

Para quem passa no filtro, há duas pistas:

- **Semelhança de conteúdo.** Cada peça vira uma lista de números que marca sua técnica, polo, categoria e faixa de preço. Os pesos respectivos são 1,0, 0,8, 0,4 e 0,3. Depois da normalização, o produto escalar dos vetores calcula a similaridade de cosseno. Características compartilhadas aproximam as peças.
- **Coocorrência.** O motor conta em quantas cestas o par aparece junto. Para cada alvo, divide a contagem do par pela contagem de seu parceiro mais frequente. Assim, esse sinal também fica entre zero e um.

A pontuação combina **60% de similaridade + 40% de coocorrência**. O motor arredonda a pontuação a quatro casas, ordena do maior para o menor e desempata pelo ID da peça. A vitrine pede até quatro sugestões. Se houver menos candidatas elegíveis, a lista será menor. A regra de pontuação é compartilhada pelos dois modos. [Pesos, vetores, pontuação e desempate](../../services/recommendation-service/app/engine.py)

### Depois, aprenda a repartir o trabalho

Um **worker** é um processo que pode receber tarefas de cálculo. O **ProcessPoolExecutor** mantém um conjunto de processos disponíveis e coleta seus resultados. Usar processos permite aproveitar vários núcleos para esse trabalho de CPU em Python. O serviço cria o executor na inicialização e o encerra no desligamento. A linha abaixo está na função `lifespan`. [Inicialização do serviço](../../services/recommendation-service/app/main.py)

~~~python
app.state.process_pool = ProcessPoolExecutor(max_workers=MAX_WORKERS)
~~~

| Onde estou? | O que é repartido? | O que é reunido no fim? |
|---|---|---|
| Na página de **uma peça** | Os **candidatos** a aparecer ao lado daquele único alvo. | Listas parciais de candidatos. O motor ordena o conjunto e escolhe as primeiras peças. |
| No **laboratório** | Os **alvos** para os quais queremos gerar recomendações. Cada tarefa compara seus alvos com o catálogo inteiro. | Um mapa de ID do alvo para sua lista de recomendações. |

No lote, 500 alvos com 4 workers permitem formar quatro grupos de 125. A função `_split_chunks` também distribui o resto quando a divisão não é exata. Estes são os dois pontos essenciais de `recommend_batch_parallel`: a divisão e a reunião das respostas. Entre eles, o código prepara cada tarefa com seu grupo, os produtos, os vetores e as coocorrências. [Divisão do lote e execução nos processos](../../services/recommendation-service/app/engine.py)

~~~python
target_chunks = _split_chunks(targets, workers)
~~~

~~~python
for partial in executor.map(_recommend_batch_chunk, tasks):
    for tid, items in partial:
        output[tid] = items
~~~

**Por que o tamanho muda a conclusão?** Com 15 alvos, o cálculo sequencial pôde terminar em cerca de meio milissegundo. Preparar grupos, transportar dados entre processos e reunir os resultados leva tempo mesmo num lote pequeno. Com 500 ou 1.000 alvos, cada processo tem muito mais comparações para executar. No lote completo, dobrar alvos **e** candidatos aproxima o número de pares examinados de quatro vezes o anterior. Nas medições publicadas, a economia com execução simultânea superou os custos nessa escala. A preparação dos dados, a comunicação e a reunião final continuam limitando o ganho.

## 4. Entendendo o Laboratório de Desempenho

Abra o **Laboratório de desempenho** pelo cabeçalho ou rodapé. A pergunta dessa tela é “quanto tempo leva gerar recomendações **para todo esse catálogo** nos dois modos?”. [Abrir a página local](http://localhost:5173/laboratorio-de-desempenho) · [Captura da configuração](evidencias/laboratorio.png)

1. **Catálogo.** “Acervo atual” usa o tamanho que o Catalog retornar. Na evidência havia 15 peças: 1 do PostgreSQL em leitura e 14 do JSON local. Sem banco, a aplicação pode usar só o acervo local. “Sintético · 200”, “500” ou “1000” define o **total** de peças do ensaio. O gerador usa o acervo como base, cria variações de produtos e acrescenta cestas em memória com semente 42. Mesma base e mesma semente reproduzem a expansão. São dados de teste identificados; os tempos são medidos de verdade. [Gerador sintético](../../services/recommendation-service/app/synthetic.py)
2. **Workers paralelos.** Escolha 2, 4 ou 8. O sequencial usa 1. A seleção define a divisão solicitada, limitada pela configuração do serviço. A máquina de referência tinha 6 núcleos físicos e 12 lógicos. O seletor não mede ocupação de CPU.
3. **Executar comparação.** Um clique inicia 12 chamadas sucessivas no navegador. Cada amostra passa por `POST /api/v1/laboratorio/amostra` no Catalog, que encaminha a `POST /recommendations/batch` no Recommendation. Este busca produtos e cestas de volta no Catalog. O quadro **Comunicação entre serviços** representa esse percurso. [Gateway do laboratório](../../services/catalog-service/app/main.py) · [Endpoint de lote](../../services/recommendation-service/app/main.py)
4. **Progresso.** A tela mostra aquecimento ou repetição, modo e chamadas concluídas. A primeira rodada roda uma vez por modo para aquecer o caminho de execução. Em seguida vêm cinco medições por modo. A ordem de quem começa alterna a cada rodada para reduzir a vantagem de sempre executar em segundo lugar. Os tempos de aquecimento ficam fora das medianas. [Orquestração no navegador](../../frontend/src/services/benchmarkService.ts)
5. **Resultado e gráficos.** O resumo identifica fonte, tamanho do lote, speedup, eficiência e workers. As barras “Cálculo” e “Requisição completa” começam em zero e compartilham uma escala em milissegundos. Barra mais curta significa menos tempo naquele intervalo. O gráfico da requisição completa inclui o percurso HTTP. [Componente da tela](../../frontend/src/views/PerformanceLab.tsx)
6. **Resultados equivalentes.** Expanda esse item para ver o digest da carga comum, os digests de saída e as dez amostras medidas. Um digest é uma assinatura calculada sobre os dados. O **input_digest** inclui produtos, cestas, alvos e limite. O **result_digest** representa o resultado completo do lote, inclusive as listas ordenadas. A interface confere origem e assinaturas em todas as 12 chamadas. Se a carga mudar ou os resultados divergirem, descarta a comparação. Se a chamada falhar, aparece a opção de tentar novamente.

### Leia os tempos antes de interpretar as barras

Estas são medianas publicadas de **500 produtos sintéticos com 4 workers**. Cada relógio responde a uma pergunta. [Respostas HTTP e valores exibidos](evidencias/lote-500.json)

| Medida | O que o relógio acompanha | Sequencial | Paralelo |
|---|---|---:|---:|
| Processamento algorítmico | Tempo decorrido no Recommendation enquanto executa a função do motor. No paralelo, inclui despacho e espera pelo pool. | 431,719 ms | 138,261 ms |
| Busca do catálogo | Tempo que o Recommendation espera pelas leituras HTTP de produtos e cestas. | 8,67 ms | 8,57 ms |
| Chamada entre serviços | Tempo que o Catalog aguarda a resposta do Recommendation. Abrange busca e cálculo. | 459,10 ms | 170,17 ms |
| Latência do cliente | Tempo que o navegador observa desde iniciar a chamada até receber e decodificar a resposta, passando pelo Next. | 464,40 ms | 175,10 ms |

Se a professora perguntar **“quanto o usuário esperou por uma amostra paralela?”**, a resposta publicada é **175,10 ms de mediana**. Os 138,261 ms de cálculo estão dentro do percurso dessa requisição. Somar as linhas contaria parte do trabalho mais de uma vez. A espera pelo **ensaio inteiro** inclui as 12 chamadas.

### Faça as contas como a interface

- **Mediana** é o valor central após ordenar as medições. Os cinco tempos paralelos de cálculo, em ms, foram **131,319 · 132,674 · 138,261 · 142,393 · 178,396** em ordem crescente. A mediana é o terceiro, **138,261**. Assim, uma única amostra muito lenta influencia menos o resumo.
- **Throughput de cálculo** é a vazão: quantos produtos-alvo recebem uma lista de recomendações por segundo de cálculo. Para o paralelo, **500 ÷ 0,138261 s = 3.616,35 produtos/s**. No sequencial, **500 ÷ 0,431719 s = 1.158,16 produtos/s**. A unidade aqui é produtos processados por segundo.
- **Speedup** mede o fator de aceleração. Divida o tempo sequencial pelo paralelo para a mesma carga: **431,719 ÷ 138,261 = 3,12×**. A redução percentual do tempo é outra conta: **(1 − 138,261 ÷ 431,719) × 100 = 67,97%**.
- **Eficiência paralela** relaciona a aceleração ao número de workers. Usando a razão antes do arredondamento: **(431,719 ÷ 138,261) ÷ 4 × 100 = 78,06%**. Isso expressa quanto da aceleração ideal de 4× foi obtido. Para medir utilização física de CPU seria preciso outro instrumento.
- **Contraprova com 15 peças.** Com os mesmos quatro workers, o cálculo passou de **0,522 ms para 1,742 ms**: **0,30×** de speedup e **7,49%** de eficiência. A latência do cliente passou de **19,2 para 21,1 ms**. O resultado continuou equivalente. A decisão defensável para essa carga é preferir o sequencial. [Ensaio com 15 peças](evidencias/lote-15.json)

**Laboratório e CLI respondem a perguntas complementares.** O laboratório calcula speedup pela razão das **medianas** e mede o cliente no navegador. A CLI também isola o motor de recomendação e registra média, mediana, dispersão e throughput. No CSV histórico da CLI, para 1.000 produtos e 8 workers, as **médias** foram 2.517,707 e 393,341 ms, gerando **6,40×** no cálculo isolado. Identifique sempre a fonte, a carga, os workers e a estatística ao citar um número. [CSV da CLI](../../benchmarks/results/benchmark_results.csv) · [Script do benchmark](../../benchmarks/benchmark_recommendations.py)

## 5. Roteiro da apresentação · cerca de 8 minutos

**Antes de começar:** suba os três processos conforme o README. Deixe abertas a peça `p01`, o laboratório, o log e a função `recommend_batch_parallel`. Confira o tamanho do acervo em `http://localhost:3001/api/v1/health`. Os números da seção anterior são uma execução salva. Durante a apresentação, leia os números da rodada que estiver na tela. [Instruções de execução](../../README.md) · [Captura do ensaio pequeno](evidencias/resultado-15.png) · [Captura do ensaio sintético](evidencias/resultado-500.png)

| Tempo | O que abrir ou clicar | O que falar | Critério e prova |
|---|---|---|---|
| **0:00–1:00** | Abra o produto `p01`. Mostre a peça, depois o diagrama da seção 2 deste guia. | “Esta é uma peça do catálogo pernambucano. Para sugerir outras, precisamos saber o que existe e calcular quais combinam. Separamos essas responsabilidades em dois serviços.” | **1 · arquitetura.** Aponte nomes, portas e responsabilidades. |
| **1:00–2:15** | Em **Você também pode gostar**, clique em **Sequencial** e depois em **Paralelo**. Mostre a chamada `recomendacoes` em Network e o trecho do log com POST e GETs. | “O navegador pede sugestões ao catálogo. O serviço de recomendação busca produtos e cestas por HTTP, calcula a lista e devolve. Aqui podemos ver as chamadas dos dois lados.” | **1 · comunicação real.** Se pedirem código, abra `fetch_catalog_from_service` em `catalog_client.py`. |
| **2:15–3:20** | Abra o laboratório e destaque **Acervo atual**. No editor, mostre somente `target_chunks` e `executor.map`. Volte à tela, selecione **4 workers** e clique em **Executar comparação**. | “Aqui a pergunta mudou. Vou calcular recomendações para cada peça. O sequencial percorre os alvos em ordem. O paralelo reparte os alvos e cada processo usa a mesma regra.” | **2 · implementação paralela.** Mostre o pool e o agrupamento em `engine.py`. |
| **3:20–4:15** | No resultado do acervo atual, leia o número de produtos, as duas barras de cálculo e o speedup. | “Nesta carga pequena, comparem os dois tempos. Quando o fator fica abaixo de um, dividir e reunir as tarefas custou mais do que o trabalho poupado.” | **2 · interpretação do primeiro ensaio.** Use a direção e os valores que efetivamente aparecerem. |
| **4:15–5:45** | Troque para **Sintético · 500 produtos**, mantenha **4 workers** e execute. Enquanto o progresso avança, aponte a fonte. Ao concluir, leia cálculo sequencial, paralelo e speedup. | “Mantive quatro workers e aumentei o lote. São dados sintéticos reproduzíveis e o cálculo acontece agora. Dividindo estes dois tempos obtenho o ganho desta rodada.” | **2 · ganho medido.** A configuração fixa de workers permite discutir o efeito do tamanho. |
| **5:45–7:10** | Mostre **Tempos do percurso distribuído**, depois abra **Resultados equivalentes**. Aponte as amostras e os dois digests de resultado. | “Fizemos um aquecimento e cinco medições por modo. O valor do meio é a mediana. Aqui está o tempo do algoritmo; aqui está a espera completa do navegador. Os digests iguais conferem que aceleramos o mesmo resultado.” | **3 · metodologia.** Se necessário, mostre `compare` em `benchmarkService.ts`. |
| **7:10–8:00** | Volte aos cartões de eficiência e throughput. Termine olhando para a professora. | “Para o acervo pequeno, o sequencial é uma escolha econômica. Para um lote maior, os processos dividiram trabalho suficiente para compensar o custo. A escolha depende da carga e do que estamos medindo.” | **3 · conclusão técnica.** Relacione o resultado a uma decisão de implementação. |

**Se surgir um imprevisto:** uma medição diferente da captura é um resultado válido. Leia a carga e a origem, confira os digests e interprete a rodada. Em caso de erro do serviço, use **Tentar novamente** após verificar as portas. Se precisar recorrer à captura, identifique-a como a medição salva.

## 6. Possíveis perguntas da professora

1. **Por que isso é distribuído se está em um computador só?** Há processos independentes com endereços e contratos próprios. O intercâmbio é feito por requisições HTTP, inclusive quando os endereços apontam para a mesma máquina.
2. **Qual vantagem justifica separar os serviços?** O Catalog centraliza a leitura dos dados. O Recommendation concentra o trabalho de CPU e o pool de processos. Isso permite ajustar o cálculo separadamente, ao custo de comunicação adicional.
3. **Por que Python e FastAPI?** Python oferece o motor numérico e o executor multiprocesso na biblioteca padrão. FastAPI expõe as rotas e valida os parâmetros. O ganho apresentado foi medido ao comparar os dois modos do mesmo motor Python.
4. **Como você comprova as chamadas de rede internas?** Mostro no log o Catalog enviando o POST à porta 3002 e o Recommendation fazendo GETs de produtos e cestas na 3001. A aba Network complementa a prova com o pedido inicial do navegador.
5. **O Recommendation acessa o banco?** Ele obtém produtos e cestas pela API do Catalog. O Catalog é quem combina o JSON local com a leitura do PostgreSQL, quando configurado, usando uma transação somente leitura.
6. **Como o motor decide que duas peças combinam?** Exige mesma técnica ou mesmo polo, descarta a própria peça e as esgotadas, e pontua as restantes por similaridade de conteúdo e coocorrência em cestas.
7. **Qual a diferença entre esperar duas respostas e calcular em paralelo?** Os dois GETs usam `asyncio.gather` para sobrepor espera de rede. O cálculo paralelo distribui tarefas de CPU entre processos. O primeiro mecanismo aparece na busca do catálogo; o segundo, no motor.
8. **Por que manter um pool?** Ele reaproveita processos entre chamadas e evita pagar a criação de um conjunto inteiro a cada recomendação. Distribuição dos dados e sincronização ainda têm custo.
9. **Como quatro workers dividem uma recomendação e um lote?** Para uma peça, repartem os candidatos. Para um lote, repartem os alvos. Em ambos os casos, os processos devolvem resultados parciais que o motor reúne.
10. **Escolher oito workers garante oito núcleos ocupados?** O seletor pede uma divisão do trabalho no pool, limitada pela configuração. A ocupação efetiva depende das tarefas, dos núcleos disponíveis e do escalonamento do sistema.
11. **Por que o caso de 15 peças vale a pena mostrar?** Ele mostra o custo da decisão. Na execução salva, quatro workers gastaram 1,742 ms de cálculo, enquanto o sequencial gastou 0,522 ms. Isso ajuda a escolher o modo para uma carga pequena.
12. **Qual número comprova o ganho?** No laboratório salvo, com 500 produtos e quatro workers, a mediana caiu de 431,719 para 138,261 ms. A razão foi 3,12× e o digest do resultado coincidiu.
13. **Os 500 produtos vieram do banco?** O serviço criou uma expansão sintética em memória, baseada no acervo, com semente 42. A interface identifica essa origem. Os tempos vêm da execução real do algoritmo.
14. **Por que fazer aquecimento?** A primeira chamada pode envolver inicialização de processos, conexões e caches. O laboratório confere sua equivalência e usa somente as cinco amostras seguintes de cada modo para resumir os tempos.
15. **Por que alternar os modos e usar mediana?** A alternância reduz a vantagem sistemática de começar ou terminar cada rodada. Com cinco valores ordenados, o terceiro representa o centro mesmo quando uma chamada foi excepcionalmente lenta.
16. **O que o digest garante?** A assinatura da entrada confere a carga comparada; a da saída confere os resultados completos dos dois modos. Dois resultados iguais ainda podem compartilhar um erro de regra, por isso também há testes funcionais. [Testes do Recommendation](../../services/recommendation-service/tests/test_recommendation.py)
17. **Posso somar os quatro tempos da tabela?** Isso duplicaria intervalos. A chamada do cliente já contém a espera do Catalog pelo Recommendation, e essa espera inclui busca e cálculo.
18. **Throughput e latência dizem a mesma coisa?** Latência é quanto tempo uma chamada leva. O throughput apresentado divide os alvos do lote pelos segundos de cálculo. Para 500 alvos em 0,138261 s, foram cerca de 3.616 produtos/s.
19. **Por que a eficiência ficou em 78%?** O ganho observado de aproximadamente 3,12× corresponde a 78,06% do ideal de 4× com quatro workers. Partes sequenciais e custos de coordenação limitam a escala; essas medições não isolam a contribuição de cada custo.
20. **Você recomendaria sempre o paralelo a partir de 200 produtos?** As cargas testadas mostram ganho em cenários sintéticos maiores nesta máquina. Para fixar um limiar de produção, eu mediria também tamanhos intermediários, hardware e carga simultânea representativos do uso real.

## 7. Resumo para revisão rápida

| Lembrete | Resposta de bolso |
|---|---|
| **40 · arquitetura** | Next 5173 apresenta. Catalog 3001 fornece dados e encaminha. Recommendation 3002 consulta o catálogo, calcula e devolve. O log prova as chamadas. |
| **35 · paralelismo** | Um alvo → repartir candidatos. Um lote → repartir alvos. O pool executa grupos em processos; o motor reúne e ordena com critério determinístico. |
| **25 · avaliação** | Mesma carga, mesmos resultados, uma rodada de aquecimento e cinco medidas por modo. Compare as medianas do mesmo intervalo. |
| **Fórmulas** | Speedup = tempo sequencial ÷ paralelo. Eficiência (%) = speedup ÷ workers × 100. Throughput = alvos ÷ segundos de cálculo. |
| **15, com 4 workers** | Cálculo 0,522 → 1,742 ms. Speedup 0,30×. O custo de repartir o trabalho aparece. |
| **500, com 4 workers** | Cálculo 431,719 → 138,261 ms. Speedup 3,12×. Cliente 464,4 → 175,1 ms. Ganho no cálculo e na experiência de espera. |
| **Último clique** | Abra os digests. Diga qual foi a carga, qual foi o resultado e por que a comparação é válida. |

**Ensaio de um minuto:** feche o guia e explique em voz alta por onde passa o pedido de `p01`, o que cada worker recebe em um lote de 500 e por que 3,12× de speedup pode coexistir com 78,06% de eficiência. Se conseguir ligar essas três respostas às telas, você já tem o fio da apresentação.
