import { env } from '../config/env.js';

export const FUSO_HORARIO_DIAS_UTEIS = 'America/Recife';

const FORMATADOR_ISO_RECIFE = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_HORARIO_DIAS_UTEIS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface CalendarioFeriados {
  ehFeriado(dataIsoYYYYMMDD: string): boolean;
}

/**
 * Calendário de feriados explícito via lista ISO `YYYY-MM-DD`.
 * Não inventa feriados fixos não especificados nos requisitos oficiais; vazio por padrão.
 */
export function createCalendarioFeriados(datasIso: readonly string[] = []): CalendarioFeriados {
  const conjunto = new Set<string>();
  for (const item of datasIso) {
    const limpo = item.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) {
      conjunto.add(limpo);
    }
  }

  return {
    ehFeriado(dataIsoYYYYMMDD: string): boolean {
      return conjunto.has(dataIsoYYYYMMDD);
    },
  };
}

export function createCalendarioFeriadosFromEnv(
  holidaysCsv: string | undefined = env.NOTIFICATION_HOLIDAYS_ISO,
): CalendarioFeriados {
  if (!holidaysCsv) {
    return createCalendarioFeriados([]);
  }
  return createCalendarioFeriados(holidaysCsv.split(','));
}

export function extrairDataIsoNoFusoOficial(data: Date): string {
  if (Number.isNaN(data.getTime())) {
    throw new RangeError('Data inválida para cálculo de dias úteis.');
  }
  return FORMATADOR_ISO_RECIFE.format(data);
}

function parseIsoParaUtcMeiaNoite(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new RangeError(`Data ISO inválida: ${iso}`);
  }
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function formatarUtcComoIso(dataUtc: Date): string {
  const ano = dataUtc.getUTCFullYear();
  const mes = String(dataUtc.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(dataUtc.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function ehDiaUtil(
  dataIsoYYYYMMDD: string,
  calendario?: CalendarioFeriados,
): boolean {
  const dataUtc = parseIsoParaUtcMeiaNoite(dataIsoYYYYMMDD);
  const diaSemana = dataUtc.getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) {
    return false;
  }
  return !(calendario?.ehFeriado(dataIsoYYYYMMDD) ?? false);
}

/**
 * Conta quantos dias úteis se passaram entre a data-calendário de `inicio` (excluída)
 * e a data-calendário de `referencia` (incluída) no fuso `America/Recife`,
 * pulando sábados, domingos e eventuais feriados fornecidos em `calendario`.
 */
export function contarDiasUteisDecorridos(
  inicio: Date,
  referencia: Date,
  calendario?: CalendarioFeriados,
): number {
  const isoInicio = extrairDataIsoNoFusoOficial(inicio);
  const isoFim = extrairDataIsoNoFusoOficial(referencia);
  if (isoFim <= isoInicio) {
    return 0;
  }

  let cursor = parseIsoParaUtcMeiaNoite(isoInicio);
  const fimUtc = parseIsoParaUtcMeiaNoite(isoFim);
  let uteis = 0;

  while (cursor.getTime() < fimUtc.getTime()) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    if (ehDiaUtil(formatarUtcComoIso(cursor), calendario)) {
      uteis += 1;
    }
  }

  return uteis;
}

/**
 * Calcula a data limite somando `quantidadeDiasUteis` (ex.: 7 para SLA de postagem da HU-13)
 * a partir de `inicio` no fuso oficial `America/Recife`.
 */
export function calcularDataLimiteDiasUteis(
  inicio: Date,
  quantidadeDiasUteis: number,
  calendario?: CalendarioFeriados,
): Date {
  if (!Number.isInteger(quantidadeDiasUteis) || quantidadeDiasUteis < 0) {
    throw new RangeError('quantidadeDiasUteis deve ser um inteiro maior ou igual a zero.');
  }

  const isoInicio = extrairDataIsoNoFusoOficial(inicio);
  let cursor = parseIsoParaUtcMeiaNoite(isoInicio);
  let restantes = quantidadeDiasUteis;

  while (restantes > 0) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    if (ehDiaUtil(formatarUtcComoIso(cursor), calendario)) {
      restantes -= 1;
    }
  }

  const isoLimite = formatarUtcComoIso(cursor);
  // 23:59:59 no fuso oficial America/Recife (UTC-3 fixo)
  return new Date(`${isoLimite}T23:59:59-03:00`);
}
