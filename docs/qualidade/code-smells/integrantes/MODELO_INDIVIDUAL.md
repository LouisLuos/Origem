# Relatório Individual: Code Smell e Refatoração
## Projeto Integrador Origem — Atividade de Qualidade de Software

> **Orientações de Uso:**  
> 1. Faça uma cópia deste arquivo neste mesmo diretório renomeando-o para o seu nome/identificador (ex.: `integrantes/cauã-santos.md`).  
> 2. Preencha todos os 12 campos obrigatórios com base na sua análise e intervenção individual.  
> 3. Não apague os títulos das seções para manter a padronização e facilitar a avaliação da professora.  

---

## 1. Identificação do Integrante

- **Nome Completo:** *[Preencher com seu nome completo]*
- **Matrícula / E-mail Institucional:** *[Preencher]*
- **Papel no Projeto:** *[Ex.: Desenvolvedor Full Stack / Engenheiro de Qualidade]*
- **Branch de Trabalho:** `feat/frontend-next`
- **Data da Conclusão:** *[DD/MM/AAAA]*

---

## 2. Code Smell Selecionado

- **Identificador no Catálogo:** *[Ex.: CS-01, CS-02, CS-03, CS-04 ou Novo]*
- **Nome Canônico:** *[Ex.: Código Duplicado (Duplicated Code) / Cirurgia por Espingarda (Shotgun Surgery)]*
- **Classificação Teórica:** *[Ex.: Fowler & Beck (1999) / Robert C. Martin (Clean Code)]*
- **Camada Afetada:** *[Ex.: Backend — Repositories / Frontend — Services / Frontend — Views]*

---

## 3. Localização e Código Original

- **Arquivo(s) de Origem:** `[Caminho relativo do arquivo, ex.: backend/src/repositories/produto.repository.ts]`
- **Linhas Afetadas:** *[Ex.: Linhas 36 a 55]*

### Trecho do Código Original
```typescript
// Cole aqui exatamente o trecho do código original que evidencia o Code Smell
```

---

## 4. Diagnóstico e Impactos na Qualidade

Apresente a análise técnica do porquê esse trecho constitui um mau cheiro de código e como ele impacta os pilares de qualidade:

- **Legibilidade:** *[Como o trecho prejudica o entendimento do código por outros desenvolvedores?]*
- **Coesão:** *[O trecho mistura responsabilidades que não pertencem àquele módulo ou classe?]*
- **Acoplamento:** *[Existe dependência indevida ou necessidade de alterar múltiplos arquivos em conjunto?]*
- **Manutenibilidade:** *[Qual o risco ou esforço necessário para dar manutenção futura nesse código?]*
- **Extensibilidade:** *[Como esse cheiro dificulta a inclusão de novas funcionalidades no Projeto Origem?]*

---

## 5. Alternativas Consideradas

Descreva pelo menos duas abordagens técnicas distintas que foram avaliadas para resolver ou endereçar o problema:

1. **Abordagem A (Refatoração X):** *[Descrição da técnica, padrões de projeto ou extrações propostas]*
   - *Vantagens:* ...
   - *Desvantagens:* ...
2. **Abordagem B (Refatoração Y):** *[Descrição de uma abordagem alternativa de menor/maior escopo]*
   - *Vantagens:* ...
   - *Desvantagens:* ...
3. **Abordagem C (Manutenção Justificada do Código Atual):** *[Avaliação pragmática de manter como está]*
   - *Vantagens:* ...
   - *Desvantagens:* ...

---

## 6. Decisão Fundamentada

- **Decisão Final:** `[ ] Refatorar o código imediatamente` | `[ ] Manter a implementação atual justificadamente`
- **Justificativa da Decisão:**  
  *[Explique de forma dissertativa, técnica e aprofundada o porquê da decisão tomada. Leve em consideração a fase atual do projeto (MVP/integração inicial), o risco de regressão funcional, o esforço exigido e os reais benefícios práticos para a equipe.]*

---

## 7. Intervenção Realizada ou Justificativa Dissertativa

> [!NOTE]  
> Preencha o bloco correspondente à decisão tomada na Seção 6.

### Opção A: Caso tenha optado por REFATORAR
- **Técnica de Refatoração Aplicada:** *[Ex.: Extract Method / Extract Class / Replace Type Code with Subclasses]*
- **Arquivos Criados ou Modificados:**
  - `caminho/do/arquivo1.ts` (modificado)
  - `caminho/do/novo_utilitario.ts` (criado)
- **Passo a Passo da Intervenção:**  
  1. *[Passo 1]*  
  2. *[Passo 2]*  
  3. *[Passo 3]*  

### Opção B: Caso tenha optado por NÃO REFATORAR (Justificativa Dissertativa)
- **Defesa Técnica Dissertativa:**  
  *[Apresente aqui um texto dissertativo completo de 2 a 4 parágrafos justificando formalmente à professora por que a intervenção agora traria mais riscos do que benefícios, demonstrando domínio teórico e visão de engenharia pragmática.]*

---

## 8. Comparação Antes vs. Depois (Quando Aplicável)

> Se optou por não refatorar, registre "Não aplicável — implementação mantida justificadamente".

### Antes da Refatoração
```typescript
// Código original antes da intervenção
```

### Depois da Refatoração
```typescript
// Código resultante após a aplicação da técnica de Clean Code
```

- **Métricas Observadas:**
  - *Linhas de código no arquivo original:* [Antes: X -> Depois: Y]
  - *Duplicações eliminadas:* [Ex.: Z linhas duplicadas removidas]

---

## 9. Testes e Evidências de Validação

Comprove que a intervenção (ou a manutenção) não quebrou nenhum contrato ou funcionalidade existente no Projeto Origem:

- **Comandos Executados:**
  ```bash
  # Exemplo:
  npm run build
  curl -s http://localhost:3001/api/v1/produtos?limit=5
  ```
- **Evidências de Sucesso:**
  ```text
  [Cole aqui trechos de log do terminal, respostas HTTP 200 OK ou saídas que comprovem que tudo continua funcionando]
  ```
- **Comportamento Visual / Telas:** *[Caso aplicável, registre que a interface no navegador permaneceu estável]*

---

## 10. Benefícios Alcançados, Riscos e Limitações

- **Benefícios Concretos:** *[O que o projeto ganhou em qualidade, clareza ou segurança?]*
- **Riscos Remanescentes:** *[Que cuidados outros desenvolvedores devem tomar ao mexer nessa área?]*
- **Limitações da Abordagem:** *[O que ainda ficou pendente ou foi deixado para as próximas etapas do projeto?]*

---

## 11. Rastreabilidade Git

- **Hash do Commit Individual:** `[Cole o hash SHA-1 do commit, ex.: a1b2c3d]`
- **Mensagem do Commit:** `[Ex.: refactor(backend): extrai normalizacao slugify e taxonomy para modulo compartilhado (CS-01)]`
- **Branch:** `feat/frontend-next`
- **Autor do Commit:** `[Seu Nome <seu-email>]`

---

## 12. Roteiro Sintético para Apresentação em Sala

> Roteiro de 2 a 3 minutos para defesa oral da sua atividade diante da professora e da turma:

1. **O Problema (30 seg):**  
   *"Identifiquei o Code Smell [Nome] no módulo [Arquivo], onde o código apresentava [descrição concisa do sintoma]..."*
2. **A Avaliação Crítica (45 seg):**  
   *"Analisei se valia a pena refatorar ou não. Concluí que a melhor decisão era [Refatorar / Manter], porque [argumento principal de custo-benefício]..."*
3. **A Ação e Resultados (45 seg):**  
   *"[Se refatorou: Apliquei a técnica de Extração e eliminei a duplicação sem quebrar as rotas] / [Se manteve: Formalizei a documentação do débito técnico e os riscos de alterar agora]..."*
4. **Lição Aprendida (30 seg):**  
   *"A principal lição aprendida foi que [reflexão sobre Clean Code, pragmatismo na engenharia ou preservação de código legado]..."*
