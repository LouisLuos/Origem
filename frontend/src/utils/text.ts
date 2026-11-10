/** Minúsculas e sem acentos, para que "ceramica" encontre "Cerâmica". */
function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

/** `true` se algum dos campos contém o termo buscado. Termo vazio casa com tudo. */
export function matchesSearch(query: string, fields: string[]) {
  const normalizedQuery = normalize(query)
  return !normalizedQuery || fields.some((field) => normalize(field).includes(normalizedQuery))
}
