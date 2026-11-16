/**
 * Utilitários para manipulação e normalização de strings no backend.
 */

/**
 * Converte uma string com acentos, caracteres especiais e espaços em um slug URL-friendly.
 * Exemplo: "Mestre Severino" -> "mestre-severino"
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Gera um identificador estável para o artesão no formato "art-<slug>".
 * Garante que produtos e perfis de artesão compartilhem exatamente a mesma chave de relacionamento.
 * Exemplo: "Mestre Severino" -> "art-mestre-severino"
 */
export function buildArtisanId(name: string): string {
  return `art-${slugify(name.trim())}`;
}
