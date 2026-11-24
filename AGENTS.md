
# Projeto Origem — Instruções do Agente

## 1. Contexto

O Origem é um marketplace de artesanato e economia criativa de Pernambuco.

O frontend já foi desenvolvido e passou por refatoração. O backend, o banco de dados e a integração com APIs reais ainda precisam ser concluídos.

O objetivo é evoluir a aplicação existente para uma solução full stack funcional, preservando as implementações corretas.

## 2. Fontes de conhecimento

Os documentos oficiais estão na pasta `Reference/`:

- `Reference/projeto-integrador-origem.md`
  Requisitos técnicos, arquitetura esperada, critérios de avaliação e entregáveis.

- `Reference/backlog-priorizado-origem.md`
  Histórias de usuário, prioridades MoSCoW, regras de negócio, cenários BDD/Gherkin e tarefas.

- `Reference/relatorio-execucao-testes-origem.md`
  Histórico de testes, falhas identificadas, bloqueios e observações técnicas.

## 3. Política de consulta

Antes de analisar, planejar ou implementar funcionalidades:

1. Identificar quais documentos são relevantes para a tarefa.
2. Consultar os trechos correspondentes.
3. Identificar os requisitos e histórias de usuário envolvidos.
4. Inspecionar o código atual antes de afirmar que algo existe ou está ausente.
5. Fundamentar propostas nos requisitos e nas evidências do repositório.
6. Informar quando um requisito estiver ambíguo, incompleto ou conflitante.

Não é necessário carregar os documentos completos em toda interação. Consultar as seções pertinentes à tarefa.

## 4. Hierarquia de evidências

- O documento do Projeto Integrador define as exigências técnicas e acadêmicas.
- O backlog define comportamentos, prioridades e critérios de aceite.
- O relatório de testes apresenta resultados históricos que precisam ser reconfirmados.
- O código atual determina o estado real da implementação.

Em caso de conflito, explicitar a divergência e solicitar uma decisão. Não escolher silenciosamente uma interpretação.

## 5. Preservação do projeto

- Não reconstruir o frontend.
- Não modificar funcionalidades corretas sem necessidade demonstrada.
- Não alterar o design sem solicitação.
- Não substituir tecnologias existentes sem justificativa e aprovação.
- Não inventar regras de negócio.
- Não considerar funcionalidades simuladas como integrações reais.
- Não implementar funcionalidades apenas porque aparecem como exemplos na documentação.

## 6. Planejamento e implementação

Antes de qualquer alteração significativa:

1. Apresentar um diagnóstico baseado no código.
2. Identificar os requisitos relacionados.
3. Propor as alterações mínimas necessárias.
4. Explicar dependências, riscos e impactos.
5. Aguardar aprovação do plano.

Na execução, trabalhar em etapas pequenas e verificáveis.

## 7. Validação e rastreabilidade

Para cada funcionalidade, relacionar:

- Identificador do requisito ou história de usuário.
- Arquivos envolvidos.
- Comportamento esperado.
- Estado encontrado no código.
- Alterações necessárias.
- Critérios de aceite.
- Testes e evidências de validação.

Não declarar um requisito concluído sem evidências adequadas.

## 8. Restrições atuais

A fase atual é exclusivamente de preparação, análise e planejamento.

Não criar backend, banco, endpoints, migrations ou alterar o frontend sem autorização explícita.
