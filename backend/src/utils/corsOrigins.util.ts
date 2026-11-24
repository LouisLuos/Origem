/**
 * Converte o valor de CORS_ORIGIN em uma lista de origens permitidas.
 * Aceita várias origens separadas por vírgula e remove espaços e barras finais,
 * pois o cabeçalho `Origin` enviado pelo navegador nunca termina com "/".
 */
export function parseCorsOrigins(valor: string | undefined): string[] {
  if (!valor) return [];
  return valor
    .split(',')
    .map((origem) => origem.trim().replace(/\/+$/, ''))
    .filter((origem) => origem.length > 0);
}
