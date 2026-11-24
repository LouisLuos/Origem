export const FUSO_HORARIO_OFICIAL = 'America/Recife';

const FORMATADOR_BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FORMATADOR_DATA_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_HORARIO_OFICIAL,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const FORMATADOR_DATA_HORA_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_HORARIO_OFICIAL,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Escapa caracteres HTML especiais para prevenir injeção de marcação ou XSS nos e-mails.
 */
export function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Garante que links renderizados em botões CTA utilizem apenas HTTP ou HTTPS.
 */
export function sanitizarUrlHttp(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Formata valor em reais brasileiros (`R$ 1.234,56`) a partir de reais decimais ou número.
 */
export function formatarMoedaBrl(valorEmReais: number): string {
  if (!Number.isFinite(valorEmReais)) {
    throw new RangeError('Valor monetário inválido para formatação em BRL.');
  }
  return FORMATADOR_BRL.format(valorEmReais).replace(/\u00a0/g, ' ');
}

/**
 * Converte data ISO ou `Date` para `DD/MM/AAAA` no fuso oficial de Pernambuco (`America/Recife`).
 */
export function formatarDataBr(entrada: Date | string): string {
  const data = entrada instanceof Date ? entrada : new Date(entrada);
  if (Number.isNaN(data.getTime())) {
    throw new RangeError('Data inválida para formatação brasileira.');
  }
  return FORMATADOR_DATA_BR.format(data);
}

/**
 * Converte data ISO ou `Date` para `DD/MM/AAAA às HH:mm` no fuso oficial (`America/Recife`).
 */
export function formatarDataHoraBr(entrada: Date | string): string {
  const data = entrada instanceof Date ? entrada : new Date(entrada);
  if (Number.isNaN(data.getTime())) {
    throw new RangeError('Data/hora inválida para formatação brasileira.');
  }
  return FORMATADOR_DATA_HORA_BR.format(data).replace(', ', ' às ');
}

/**
 * Converte valores numéricos aceitos (Date | ISO string) em `Date` válida.
 */
export function parseDataValida(entrada: Date | string): Date {
  const data = entrada instanceof Date ? entrada : new Date(entrada);
  if (Number.isNaN(data.getTime())) {
    throw new RangeError('Data inválida.');
  }
  return data;
}
