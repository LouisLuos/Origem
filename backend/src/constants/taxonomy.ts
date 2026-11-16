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
 * Normaliza o identificador bruto da técnica para a denominação oficial exibida no Design System.
 * Caso a técnica não esteja explicitamente mapeada, retorna o valor original sem alterações.
 */
export function formatTechnique(rawTechnique: string): string {
  return TECHNIQUE_MAP[rawTechnique] ?? rawTechnique;
}
