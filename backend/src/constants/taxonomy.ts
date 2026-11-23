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
 * Tipologias aceitas no cadastro de peças ("tipologia homologada").
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
 * Polos culturais pernambucanos aceitos no cadastro de ateliê ("polo homologado").
 * Reúne os polos citados no backlog (Alto do Moura/Caruaru, Tracunhaém, Bezerros, Pesqueira,
 * Goiana), os do Design System (`culturalHubs`) e os do catálogo da IA (Passira).
 * Deve permanecer idêntica a `atelierCulturalHubs` em frontend/src/services/atelierService.ts.
 */
export const POLOS_CULTURAIS_HOMOLOGADOS = [
  'Caruaru',
  'Alto do Moura',
  'Nazaré da Mata',
  'Tracunhaém',
  'Bezerros',
  'Garanhuns',
  'Pesqueira',
  'Goiana',
  'Passira',
] as const;

export type PoloCulturalHomologado = (typeof POLOS_CULTURAIS_HOMOLOGADOS)[number];

/**
 * Normaliza o identificador bruto da técnica para a denominação oficial exibida no Design System.
 * Caso a técnica não esteja explicitamente mapeada, retorna o valor original sem alterações.
 */
export function formatTechnique(rawTechnique: string): string {
  return TECHNIQUE_MAP[rawTechnique] ?? rawTechnique;
}

const CERAMICA_ALIASES = new Set([
  'ceramica',
  'ceramica figurativa',
  'barro',
  'barro/ceramica',
  'ceramica/barro',
]);

function normalizeTaxonomyToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Expande sinônimos culturais da tipologia (ex.: "Barro/Cerâmica" <-> "Cerâmica Figurativa")
 * para garantir consistência entre os filtros da vitrine (HU-07 Cenário 1), o banco PostgreSQL
 * e o catálogo legado.
 */
export function expandTechniqueAliases(rawTechnique: string): string[] {
  const trimmed = rawTechnique.trim();
  const normalized = normalizeTaxonomyToken(trimmed);

  if (CERAMICA_ALIASES.has(normalized)) {
    return ['Cerâmica Figurativa', 'Barro/Cerâmica', 'Cerâmica', 'Barro', 'ceramica'];
  }

  const mapped = TECHNIQUE_MAP[normalized];
  if (mapped && mapped.toLowerCase() !== trimmed.toLowerCase()) {
    return [trimmed, mapped];
  }

  return [trimmed];
}

export function matchesTechniqueTaxonomy(pieceTechnique: string, filterTechnique: string): boolean {
  const pieceNorm = normalizeTaxonomyToken(pieceTechnique);
  const filterNorm = normalizeTaxonomyToken(filterTechnique);

  if (pieceNorm === filterNorm) {
    return true;
  }

  if (CERAMICA_ALIASES.has(pieceNorm) && CERAMICA_ALIASES.has(filterNorm)) {
    return true;
  }

  const aliases = expandTechniqueAliases(filterTechnique).map(normalizeTaxonomyToken);
  return aliases.includes(pieceNorm);
}
