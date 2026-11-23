# ADR-001: Adotar Portas e Adaptadores para isolar a cotação de frete

- **Status:** Aceita
- **Data:** 2026-11-22
- **Autor:** VINICIUS GABRIEL DOS SANTOS BRAZ (vgsb@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O backend do Origem está sendo desenvolvido com Express e TypeScript, organizado em camadas. O backlog prevê que a cotação use o CEP de origem do ateliê, o CEP de entrega e a cubagem da peça, mas a integração real com uma API logística ainda não está implementada.

## Preocupações

Custo de mudança, testabilidade, acoplamento com provedor externo, desempenho, prazo de implementação

## Decisão

Definir uma porta interna para a cotação de frete e implementar a comunicação com o provedor logístico em um adaptador que cumpra esse contrato. O serviço de negócio usará a porta, sem depender diretamente dos detalhes da API externa.

## Justificativa

A separação concentra mudanças de formato, autenticação ou tratamento de erros do provedor no adaptador e permite testar o serviço sem chamar a API externa. A troca do provedor deve exigir alterações localizadas, sem mudar as regras de pedido ou catálogo. Isso adiciona o custo de manter o contrato, o adaptador e seus testes, mas evita espalhar a dependência externa pelo backend. A solução complementa as camadas existentes, sem criar um microsserviço adicional.

## Consequências

Ganhamos isolamento do provedor: mudanças na API logística tendem a ficar concentradas no adaptador, e os testes do serviço podem usar uma implementação simulada, sem chamadas externas. Isso reduz o risco de uma troca afetar as regras de pedido e catálogo. Em contrapartida, teremos mais código e indireção para manter: a porta, o adaptador, o mapeamento de erros e respostas e os testes de contrato.

## Alternativas consideradas

Chamar a API logística diretamente na rota ou no serviço de negócio: descartada porque acopla as regras do marketplace ao formato e às falhas de um provedor específico, tornando sua substituição mais arriscada.
Manter apenas a arquitetura em camadas, sem uma porta específica: descartada porque separar rotas, serviços e repositórios não impede, por si só, que o serviço de negócio dependa diretamente da API externa.

## Rastreabilidade

**Atributo de qualidade:** Manutenibilidade · Modificabilidade

**Cenário que originou a decisão:**

> Um desenvolvedor da equipe recebe a demanda de alterar ou substituir o provedor de cotação de frete usado na compra. Em ambiente de desenvolvimento, antes da publicação em produção, ele adapta o serviço de cotação e sua integração com o checkout sem alterar as regras de negócio do pedido, do catálogo ou do cadastro do endereço de origem do ateliê. A mudança toca no máximo dois módulos, é concluída em até um ciclo de sprint e passa nos testes automatizados relacionados à cotação e ao checkout.

**Padrão arquitetural adotado:** Portas e Adaptadores

**Táticas empacotadas:** Encapsular a dependência externa; Usar intermediário (a porta); Inverter e injetar dependência; Isolar dependência externa para teste



## Verificação

- **Teste do cenário:** O teste executa o serviço com dois adaptadores simulados e confirma que ambos recebem o CEP de origem, o CEP de destino e a cubagem, e retornam o mesmo formato interno de cotação. Resultado: 1 teste passou. A troca entre adaptadores, portanto, não exige mudança no serviço testado.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
