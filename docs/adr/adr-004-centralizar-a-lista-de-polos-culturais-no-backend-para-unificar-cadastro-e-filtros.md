# ADR-004: Centralizar a lista de polos culturais no backend para unificar cadastro e filtros

- **Status:** Aceita
- **Data:** 2026-11-23
- **Autor:** PEDRO VINICIUS SILVA DE SOUZA (pvss@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

Hoje o cadastro de peças/ateliês no backend aceita 9 polos em backend/src/constants/taxonomy.ts (POLOS_CULTURAIS_HOMOLOGADOS), mas o frontend mantém outra lista fixa com apenas 6 polos em frontend/src/design-system/tokens.ts (culturalHubs). Por causa disso, peças de polos como Pesqueira, Goiana e Passira existem na API, mas não aparecem nos filtros da vitrine nem no <select> do painel do artesão.

## Preocupações

facilidade de mudança, consistência entre telas e API, prazo, custo de manutenção

## Decisão

Manter a lista oficial de polos culturais apenas na camada de serviço/constantes do backend (taxonomy.ts), expondo uma rota de consulta para que os filtros da vitrine (ProductFilters.tsx) e o formulário do artesão (ArtisanProductForm.tsx) carreguem as opções direto do servidor.

## Justificativa

Atende ao cenário da etapa 2 porque acaba com a duplicação da lista entre frontend e backend. Ao adicionar um novo polo em taxonomy.ts, o filtro da vitrine e o formulário do artesão passam a exibir o novo polo automaticamente sem precisar editar componentes de tela, em até 2 horas e sem erros no build.

## Consequências

Ganhos: fim da divergência entre os 6 polos do site e os 9 do backend; alteração rápida em um único arquivo quando surgir um novo polo.
Perdas: o frontend passa a depender de uma requisição à API para montar os <select> e filtros (exigindo um estado de carregamento ou fallback se a API falhar), além de exigir cuidado nos reviews para ninguém voltar a escrever listas fixas em tokens.ts.

## Alternativas consideradas

Manter listas fixas duplicadas no frontend e no backend: descartada porque gera o defeito atual.
Portas e Adaptadores com repositório próprio só para polos: descartada por criar arquivos e interfaces demais para uma lista simples dentro do prazo de um semestre.

## Rastreabilidade

**Atributo de qualidade:** Manutenibilidade · Modificabilidade

**Cenário que originou a decisão:**

> Em ambiente de de desenvolvimento em manutenção de rotina, o desenvolvedor quer adicionar um novo polo cultural no filtro, catalogo e cadastro do artesão. O novo polo passa a aparecer automaticamente nos filtros de busca e nas opções de cadastro sem necessidade de editar componentes de tela, modificando um modulo, em ate 2 horas e com 0 erros na compilação.

**Padrão arquitetural adotado:** Camadas

**Táticas empacotadas:** Encapsular responsabilidades por faixa; Restringir dependências a uma direção; Usar intermediário entre camadas

HU-06 (Filtro cultural), HU-09 (Cadastro de peças), CS-05

## Verificação

- **Teste do cenário:** Adicionar um novo polo (ex.: "Bonito") apenas em backend/src/constants/taxonomy.ts e validar: (1) o formulário de peça (ArtisanProductForm.tsx) passa a listar "Bonito" para o artesão; (2) ao cadastrar uma peça e filtrar na vitrine (GET /produtos?polo=Bonito e ProductFilters.tsx), o item aparece corretamente; (3) pelo git diff --stat, apenas 1 módulo foi editado em até 2 horas, com 0 erros no build.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
