const STOPWORDS_PT = new Set([
  'a',
  'as',
  'o',
  'os',
  'de',
  'da',
  'das',
  'do',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'e',
  'com',
  'para',
  'por',
])

const CERAMICA_ALIASES = new Set([
  'ceramica',
  'ceramica figurativa',
  'barro',
  'barro/ceramica',
  'ceramica/barro',
])

/** Minúsculas e sem acentos, para que "ceramica" encontre "Cerâmica". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

export function extractSearchTokens(query: string): string[] {
  const normalized = normalizeText(query)
  if (!normalized) return []
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS_PT.has(token))
  return tokens.length > 0 ? tokens : [normalized]
}

function tokenMatchesText(token: string, normalizedTarget: string): boolean {
  if (normalizedTarget.includes(token)) return true
  if (token.endsWith('s') && token.length > 3) {
    return normalizedTarget.includes(token.slice(0, -1))
  }
  return false
}

/**
 * `true` se todos os termos relevantes da consulta FTS aparecem no conjunto de campos
 * (ex.: "maracatu barro" encontra peça com "Maracatu" no título e "barro" na descrição — HU-07 Cenário 2).
 */
export function matchesSearch(query: string, fields: Array<string | undefined | null>): boolean {
  const tokens = extractSearchTokens(query)
  if (tokens.length === 0) return true

  const combinedDocument = fields
    .filter((f): f is string => typeof f === 'string' && f.length > 0)
    .map(normalizeText)
    .join(' ')

  return tokens.every((token) => tokenMatchesText(token, combinedDocument))
}

/**
 * Calcula relevância textual FTS ponderando matches no título (peso A=1.0)
 * acima de matches na descrição/metadados (peso B=0.4) — HU-07 Cenário 2.
 */
export function scoreSearchRelevance(
  query: string,
  target: { title: string; description?: string; technique?: string; hub?: string; artisan?: string },
): number {
  const tokens = extractSearchTokens(query)
  if (tokens.length === 0) return 0

  const titleNorm = normalizeText(target.title)
  const descNorm = normalizeText(
    [target.description, target.technique, target.hub, target.artisan].filter(Boolean).join(' '),
  )

  let score = 0
  for (const token of tokens) {
    const inTitle = tokenMatchesText(token, titleNorm)
    const inDesc = tokenMatchesText(token, descNorm)
    if (!inTitle && !inDesc) return 0
    if (inTitle) score += 1.0
    if (inDesc) score += 0.4
  }

  const exactPhrase = normalizeText(query)
  if (exactPhrase && titleNorm.includes(exactPhrase)) {
    score += 0.5
  }

  return score
}

/**
 * Compara técnica da peça com o filtro selecionado aceitando sinônimos culturais
 * como "Barro/Cerâmica" <-> "Cerâmica Figurativa" (HU-07 Cenário 1).
 */
export function matchesTechniqueOption(pieceTechnique: string, selectedTechniques: string[]): boolean {
  if (selectedTechniques.length === 0) return true
  const pieceNorm = normalizeText(pieceTechnique)
  return selectedTechniques.some((selected) => {
    const selNorm = normalizeText(selected)
    if (pieceNorm === selNorm) return true
    return CERAMICA_ALIASES.has(pieceNorm) && CERAMICA_ALIASES.has(selNorm)
  })
}
