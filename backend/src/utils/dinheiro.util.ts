/**
 * Utilitários financeiros determinísticos baseados em centavos inteiros.
 * Elimina imprecisões de ponto flutuante (IEEE 754) e garante compatibilidade exata
 * com colunas `DECIMAL(10, 2)` e constraints CHECK no PostgreSQL.
 */

const DECIMAL_STR_REGEX = /^([+-])?(\d+)(?:\.(\d+))?$/;

/**
 * Converte string decimal (`"149.90"`), número ou objeto com `.toString()` (ex.: Prisma `Decimal`)
 * para centavos inteiros exatos.
 */
export function decimalParaCentavos(valor: string | number | { toString(): string }): number {
  const bruto = (typeof valor === 'number' ? valor.toFixed(4) : valor.toString()).trim();
  const match = DECIMAL_STR_REGEX.exec(bruto);
  if (!match) {
    throw new Error(`Valor monetário inválido para conversão em centavos: "${bruto}"`);
  }

  const sinal = match[1] === '-' ? -1 : 1;
  const inteiros = Number.parseInt(match[2]!, 10);
  const fracaoBruta = (match[3] ?? '').padEnd(3, '0');
  const centavosBase = Number.parseInt(fracaoBruta.slice(0, 2), 10);
  const terceiroDigito = Number.parseInt(fracaoBruta[2] ?? '0', 10);

  let centavos = inteiros * 100 + centavosBase;
  if (terceiroDigito >= 5) {
    centavos += 1;
  }

  const resultado = sinal * centavos;
  if (!Number.isSafeInteger(resultado)) {
    throw new Error('Valor monetário excede o limite seguro de inteiros.');
  }
  return resultado;
}

/** Converte centavos inteiros para número com exatamente 2 casas decimais. */
export function centavosParaNumero(centavos: number): number {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error('Quantidade de centavos deve ser um número inteiro seguro.');
  }
  return Number((centavos / 100).toFixed(2));
}

/** Converte centavos inteiros para string decimal fixa (`"149.90"`), ideal para persistência `DECIMAL(10,2)`. */
export function centavosParaDecimalString(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error('Quantidade de centavos deve ser um número inteiro seguro.');
  }
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const reais = Math.floor(abs / 100);
  const resto = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}${reais}.${resto}`;
}

/** Soma segura de uma lista de valores em centavos inteiros. */
export function somarCentavos(valores: readonly number[]): number {
  let soma = 0;
  for (const valor of valores) {
    if (!Number.isSafeInteger(valor)) {
      throw new Error('Todos os operandos de soma monetária devem estar em centavos inteiros.');
    }
    soma += valor;
  }
  return soma;
}
