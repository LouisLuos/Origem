import crypto from 'node:crypto';
import { z } from 'zod';
import {
  PAGAMENTO_ERROR_CODES,
  type MetodoPagamentoGateway,
} from '../integrations/paymentGateway.contracts.js';
import { normalizarCepDigitos } from '../services/frete.service.js';
import { AppError } from '../utils/AppError.js';
import { isUuid } from '../utils/uuid.util.js';

const IDEMPOTENCY_KEY_MAX = 128;

const CAMPOS_SENSIVEIS_CARTAO_PROIBIDOS = new Set([
  'numerocartao',
  'numero_cartao',
  'cardnumber',
  'card_number',
  'pan',
  'cvv',
  'cvc',
  'securitycode',
  'security_code',
  'codigoseguranca',
  'codigo_seguranca',
  'cardcvv',
  'card_cvv',
]);

function verificarAusenciaDadosSensiveisCartao(valor: unknown, profundidade = 0): void {
  if (profundidade > 4 || valor === null || typeof valor !== 'object') {
    return;
  }

  if (Array.isArray(valor)) {
    for (const item of valor) {
      verificarAusenciaDadosSensiveisCartao(item, profundidade + 1);
    }
    return;
  }

  for (const [chave, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    const chaveLimpa = chave.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (CAMPOS_SENSIVEIS_CARTAO_PROIBIDOS.has(chaveLimpa) && conteudo !== undefined && conteudo !== '') {
      throw new AppError(
        'Dados sensíveis de cartão (número completo ou CVV) são proibidos no backend. Utilize apenas tokenização gerada no navegador pelo provedor oficial.',
        422,
        PAGAMENTO_ERROR_CODES.DADOS_SENSIVEIS_CARTAO_PROIBIDOS,
      );
    }
    verificarAusenciaDadosSensiveisCartao(conteudo, profundidade + 1);
  }
}

export function normalizarParamExpress(valor: string | string[] | undefined): string {
  if (typeof valor === 'string') return valor.trim();
  if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0].trim();
  return '';
}

function extrairIdempotencyKeyCheckout(headerValue: unknown, bodyValue: unknown): string {
  const brutoHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const candidato =
    brutoHeader !== undefined && brutoHeader !== '' ? brutoHeader : bodyValue;

  if (candidato === undefined || candidato === null || candidato === '') {
    return crypto.randomUUID();
  }

  if (typeof candidato !== 'string') {
    throw new AppError('Cabeçalho Idempotency-Key inválido.', 422);
  }

  const trimmed = candidato.trim();
  if (
    trimmed.length < 4 ||
    trimmed.length > IDEMPOTENCY_KEY_MAX ||
    /[\r\n\x00-\x1f\x7f\s]/.test(trimmed)
  ) {
    throw new AppError(
      `Idempotency-Key deve conter entre 4 e ${IDEMPOTENCY_KEY_MAX} caracteres sem espaços.`,
      422,
    );
  }

  return trimmed;
}

const cotacaoFreteSchema = z.object({
  reservaGrupoId: z.string().trim().refine(isUuid, 'reservaGrupoId inválido.'),
  cepDestino: z
    .string()
    .trim()
    .transform(normalizarCepDigitos)
    .refine((v) => /^\d{8}$/.test(v), 'cepDestino deve conter 8 dígitos numéricos.'),
});

export interface CotacaoFreteCheckoutInput {
  readonly reservaGrupoId: string;
  readonly cepDestino: string;
}

export function validarCotacaoFreteCheckout(body: unknown): CotacaoFreteCheckoutInput {
  verificarAusenciaDadosSensiveisCartao(body);
  const parsed = cotacaoFreteSchema.parse(body);
  return {
    reservaGrupoId: parsed.reservaGrupoId.toLowerCase(),
    cepDestino: parsed.cepDestino,
  };
}

const enderecoEntregaSchema = z.object({
  nomeDestinatario: z.string().trim().min(2, 'Nome do destinatário é obrigatório.').max(120),
  email: z.string().trim().email('E-mail do destinatário inválido.').max(160),
  telefone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 10 && v.length <= 13, 'Telefone do destinatário inválido.'),
  cep: z
    .string()
    .trim()
    .transform(normalizarCepDigitos)
    .refine((v) => /^\d{8}$/.test(v), 'CEP de entrega deve conter 8 dígitos numéricos.'),
  logradouro: z.string().trim().min(2, 'Logradouro é obrigatório.').max(180),
  numero: z.string().trim().min(1, 'Número do endereço é obrigatório.').max(30),
  complemento: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  bairro: z.string().trim().min(2, 'Bairro é obrigatório.').max(120),
  cidade: z.string().trim().min(2, 'Cidade é obrigatória.').max(120),
  uf: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{2}$/.test(v), 'UF deve conter 2 letras maiúsculas (ex.: PE).'),
});

const cartaoTokenizadoSchema = z.object({
  token: z.string().trim().min(8, 'Token do cartão inválido ou ausente.').max(512),
  parcelas: z.number().int().min(1, 'Parcelas deve ser no mínimo 1.').max(12, 'Máximo 12 parcelas.').default(1),
  bandeira: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  ultimosDigitos: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Últimos dígitos do cartão devem ter exatamente 4 números.')
    .optional(),
});

const checkoutBodySchema = z
  .object({
    reservaGrupoId: z.string().trim().refine(isUuid, 'reservaGrupoId inválido.'),
    metodoPagamento: z.enum(['PIX', 'CARTAO_CREDITO']),
    enderecoEntregaId: z
      .string()
      .trim()
      .refine(isUuid, 'enderecoEntregaId inválido.')
      .optional(),
    enderecoEntrega: enderecoEntregaSchema,
    cartao: cartaoTokenizadoSchema.optional(),
    idempotencyKey: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.metodoPagamento === 'CARTAO_CREDITO' && !data.cartao) {
      ctx.addIssue({
        code: 'custom',
        path: ['cartao'],
        message: 'Token e parcelas do cartão são obrigatórios para pagamento em CARTAO_CREDITO.',
      });
    }
    if (data.metodoPagamento === 'PIX' && data.cartao !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['cartao'],
        message: 'Dados de cartão não devem ser enviados quando metodoPagamento=PIX.',
      });
    }
  });

export interface CheckoutValidado {
  readonly reservaGrupoId: string;
  readonly metodoPagamento: MetodoPagamentoGateway;
  readonly enderecoEntregaId?: string;
  readonly enderecoEntrega: z.infer<typeof enderecoEntregaSchema>;
  readonly cartao?: z.infer<typeof cartaoTokenizadoSchema>;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
}

export function validarCriacaoCheckout(
  body: unknown,
  idempotencyKeyHeader?: unknown,
): CheckoutValidado {
  verificarAusenciaDadosSensiveisCartao(body);
  const parsed = checkoutBodySchema.parse(body);
  const idempotencyKey = extrairIdempotencyKeyCheckout(idempotencyKeyHeader, parsed.idempotencyKey);

  // Hash canônico sem armazenar token bruto em texto plano
  const resumoCanonico = {
    reservaGrupoId: parsed.reservaGrupoId.toLowerCase(),
    metodoPagamento: parsed.metodoPagamento,
    enderecoEntregaId: parsed.enderecoEntregaId?.toLowerCase() ?? null,
    enderecoEntrega: parsed.enderecoEntrega,
    cartaoHash: parsed.cartao
      ? {
          tokenDigest: crypto.createHash('sha256').update(parsed.cartao.token).digest('hex'),
          parcelas: parsed.cartao.parcelas,
        }
      : null,
  };

  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(resumoCanonico))
    .digest('hex');

  return {
    reservaGrupoId: parsed.reservaGrupoId.toLowerCase(),
    metodoPagamento: parsed.metodoPagamento,
    enderecoEntregaId: parsed.enderecoEntregaId?.toLowerCase(),
    enderecoEntrega: parsed.enderecoEntrega,
    cartao: parsed.cartao,
    idempotencyKey,
    payloadHash,
  };
}

export function validarGatewayWebhookParam(rawParam: string | string[] | undefined): string {
  const normalizado = normalizarParamExpress(rawParam).toLowerCase();
  if (normalizado === 'pagarme_v5' || normalizado === 'pagarme') return 'pagarme_v5';
  if (normalizado === 'mercado_pago' || normalizado === 'mercadopago') return 'mercado_pago';
  if (normalizado === 'http_sandbox') return 'http_sandbox';

  throw new AppError(`Gateway de webhook desconhecido: "${normalizado || 'vazio'}".`, 400);
}

const CODIGO_PEDIDO_REGEX = /^OR-[A-Z0-9-]{4,30}$/;

export function validarParametroPedidoIdOuCodigo(rawParam: string | string[] | undefined): {
  readonly tipo: 'id' | 'codigoPedido';
  readonly valor: string;
} {
  const limpo = normalizarParamExpress(rawParam);
  const upper = limpo.toUpperCase();
  if (CODIGO_PEDIDO_REGEX.test(upper)) {
    return { tipo: 'codigoPedido', valor: upper };
  }
  if (isUuid(limpo)) {
    return { tipo: 'id', valor: limpo.toLowerCase() };
  }
  throw new AppError('Identificador do pedido inválido.', 422);
}
