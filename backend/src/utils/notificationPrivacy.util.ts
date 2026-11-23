import { createHash } from 'node:crypto';

export type CanalNotificacaoPrivacy = 'EMAIL' | 'WHATSAPP';

const TAMANHO_MAX_ERRO_SANITIZADO = 500;
const TAMANHO_MAX_IDEMPOTENCY_KEY = 128;

/**
 * Mascara endereço de e-mail para persistência em auditoria sem exposição de PII completo.
 * Exemplo: `maria.silva@origem.pe.br` -> `m***@origem.pe.br`.
 */
export function mascararEmail(email: string): string {
  const limpo = email.trim().toLowerCase();
  const indiceArroba = limpo.indexOf('@');
  if (indiceArroba <= 0 || indiceArroba === limpo.length - 1) {
    return '***';
  }

  const local = limpo.slice(0, indiceArroba);
  const dominio = limpo.slice(indiceArroba + 1);
  const visivel = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visivel}***@${dominio}`;
}

/**
 * Normaliza telefone WhatsApp brasileiro (10-11 dígitos ou DDI 55 + 10-11 dígitos) para E.164 (`+55...`).
 * Retorna `null` quando o número não possui formato válido.
 */
export function normalizarTelefoneWhatsappE164(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) {
    return null;
  }

  if (digitos.length === 10 || digitos.length === 11) {
    return `+55${digitos}`;
  }

  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    return `+${digitos}`;
  }

  return null;
}

/**
 * Mascara telefone WhatsApp preservando apenas DDI/DDD e os 4 dígitos finais.
 */
export function mascararTelefoneWhatsapp(telefone: string): string {
  const normalizado = normalizarTelefoneWhatsappE164(telefone);
  const digitos = (normalizado ?? telefone).replace(/\D/g, '');
  if (digitos.length < 6) {
    return '***';
  }

  const finais = digitos.slice(-4);
  const prefixo = digitos.startsWith('55') && digitos.length >= 12 ? `+${digitos.slice(0, 4)}` : '';
  return `${prefixo}*****${finais}`;
}

/**
 * Seleciona a rotina de mascaramento apropriada ao canal da notificação.
 */
export function mascararDestinatario(canal: CanalNotificacaoPrivacy, destinatario: string): string {
  return canal === 'EMAIL'
    ? mascararEmail(destinatario)
    : mascararTelefoneWhatsapp(destinatario);
}

/**
 * Sanitiza mensagens de erro externas antes de persistir em banco ou registrar em log,
 * removendo tokens, credenciais de URL, segredos, e-mails e telefones.
 */
export function sanitizarErroProvedor(erro: unknown): string {
  const bruto =
    erro instanceof Error
      ? erro.message
      : typeof erro === 'string'
        ? erro
        : 'Falha no provedor de notificação.';

  const sanitizado = bruto
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(https?:\/\/)([^:@\s]+):([^@\s]+)@/gi, '$1[REDACTED]@')
    .replace(
      /\b(api[_-]?key|access[_-]?token|token|secret|password|pass|authorization)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    )
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_OMITIDO]')
    .replace(/\+?\d[\d\s\-()]{7,18}\d/g, '[TELEFONE_OMITIDO]')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!sanitizado) {
    return 'Falha no provedor de notificação.';
  }

  return sanitizado.length > TAMANHO_MAX_ERRO_SANITIZADO
    ? `${sanitizado.slice(0, TAMANHO_MAX_ERRO_SANITIZADO - 3)}...`
    : sanitizado;
}

/**
 * Constrói chave de idempotência determinística compatível simultaneamente com:
 * - PostgreSQL (`VARCHAR(160)` único);
 * - BullMQ (`jobId` sem o caractere `:`, estritamente `[a-zA-Z0-9_-]`).
 */
export function construirChaveIdempotenciaNotificacao(
  prefixo: string,
  partes: readonly (string | number | boolean | null | undefined)[],
): string {
  const prefixoLimpo =
    prefixo
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'notif';

  const canonico = partes.map((parte) => String(parte ?? '')).join('|');
  const digest = createHash('sha256').update(canonico).digest('hex');
  const resultado = `${prefixoLimpo}_${digest}`;
  return resultado.slice(0, TAMANHO_MAX_IDEMPOTENCY_KEY);
}
