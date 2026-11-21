/**
 * Mapeamento das técnicas do catálogo da IA para a taxonomia visual do Design System.
 * Centraliza a correspondência de nomes para evitar divergências entre produtos e artesãos.
 */
export const TECHNIQUE_MAP: Record<string, string> = {
  ceramica: 'Cerâmica Figurativa',
  couro: 'Couro',
  xilogravura: 'Xilogravura',
  papel_mache: 'Papel Machê',
  renda_renascenca: 'Renda Renascença',
  bordado: 'Bordado',
};

/**
 * Tipologias aceitas no cadastro de peças (HU-05, "tipologia homologada").
 *
 * Os documentos normativos não fecham uma lista (a modelagem usa `varchar` e a análise de domínio
 * cita apenas exemplos). Por compatibilidade, a lista reúne as técnicas já usadas pelo projeto:
 * - as do Design System (frontend/src/design-system/tokens.ts → `techniques`);
 * - as do catálogo da IA (`TECHNIQUE_MAP`: inclui Couro e Papel Machê).
 * Deve permanecer idêntica a `pieceTypologies` em frontend/src/services/pieceService.ts.
 */
export const TIPOLOGIAS_HOMOLOGADAS = [
  'Cerâmica Figurativa',
  'Renda Renascença',
  'Xilogravura',
  'Marcenaria',
  'Cordel',
  'Bordado',
  'Couro',
  'Papel Machê',
] as const;

export type TipologiaHomologada = (typeof TIPOLOGIAS_HOMOLOGADAS)[number];

/**
 * Normaliza o identificador bruto da técnica para a denominação oficial exibida no Design System.
 * Caso a técnica não esteja explicitamente mapeada, retorna o valor original sem alterações.
 */
export function formatTechnique(rawTechnique: string): string {
  return TECHNIQUE_MAP[rawTechnique] ?? rawTechnique;
}
