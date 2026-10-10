# 🤖 ia-recomendador — Recomendação Contextual de Peças Afins (HU-24)

Mockup executável do módulo de IA especificado na AV1 de **Engenharia de Software e IA**,
servido com **BentoML** (Trilha A — recomendação/ranqueamento). Base:
[lgallindo/recomendador-bentoml](https://github.com/lgallindo/recomendador-bentoml).

> **Instalação, execução, tabela RF → endpoint e casos de teste estão no
> [README da raiz](../README.md#-módulo-de-ia--recomendador-av1-prática).**

## Como funciona

Dois momentos separados, como no repositório base:

| Momento | Arquivo | O que faz |
|---|---|---|
| **Offline (treino)** | [`treino.py`](treino.py) | Lê [`dados/catalogo.json`](dados/catalogo.json), vetoriza as peças, calcula similaridade e co-compra e grava o artefato no *model store* do BentoML (`origem-recomendador:latest`) |
| **Online (serviço)** | [`service.py`](service.py) | Carrega o artefato e responde HTTP em `POST /recomendar` e `POST /catalogo` |
| Lógica pura | [`recomendador.py`](recomendador.py) | Funções sem dependência do BentoML, testadas em [`tests/`](tests/test_recomendador.py) |

### Algoritmo (T-IA-01 + T-IA-02)

1. **Features (T-IA-01):** cada peça vira um vetor *one-hot* ponderado de
   `técnica` (peso 1,0), `polo` de origem (0,8), `categoria` (0,4) e `faixa de preço` (0,3:
   até R$ 100 / R$ 100–200 / acima de R$ 200).
2. **Similaridade de conteúdo (T-IA-02):** cosseno entre o vetor da peça aberta e o de cada outra peça.
3. **Co-compra (Cenário 2 da HU-24):** a partir das `cestas` (compras sintéticas), quanto
   cada par de peças sai junto, normalizado em 0–1.
4. **Score final:** `0,6 × cosseno + 0,4 × co-compra`.
5. **Regras do BDD (Cenário 1):** só entram peças da **mesma técnica ou do mesmo polo**,
   nunca a própria peça, nunca peça com **estoque 0**; padrão de 4 sugestões, máximo 6.

Cada item devolvido traz `score`, `similaridade`, `coocorrencia` e `motivos`
(`mesma_tecnica`, `mesmo_polo`, `comprados_juntos`) para a recomendação ser explicável.

### O que é mock

- Catálogo e cestas são **sintéticos** (14 peças, 10 compras), inspirados no catálogo do Origem.
- Não há integração com o banco PostgreSQL nem com o frontend (T-IA-03 fica para a Unidade 2).
