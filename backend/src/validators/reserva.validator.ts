import crypto from 'node:crypto';
import { z } from 'zod';
import {
  RESERVA_ERROR_CODES,
  type ItemReservaSolicitado,
} from '../repositories/contracts/reservas.contracts.js';
import { AppError } from '../utils/AppError.js';
import { isUuid } from '../utils/uuid.util.js';

const INT4_MAX = 2_147_483_647;
const MAX_ITENS_RESERVA = 50;
const IDEMPOTENCY_KEY_MAX = 128;

export interface CriacaoReservaValidada {
  readonly itens: readonly ItemReservaSolicitado[];
  readonly idempotencyKey: string;
  readonly payloadHash: string;
}

const rawItemSchema = z.object(
  {
    pecaId: z.unknown().optional(),
    productId: z.unknown().optional(),
    quantidade: z.unknown().optional(),
    quantity: z.unknown().optional(),
  },
  { error: 'Cada item da reserva deve ser um objeto JSON.' },
);

const rawBodySchema = z.object(
  {
    itens: z.unknown().optional(),
    lines: z.unknown().optional(),
    idempotencyKey: z.unknown().optional(),
  },
  { error: 'O corpo da requisição de reserva deve ser um objeto JSON.' },
);

function extrairIdempotencyKey(headerValue: unknown, bodyValue: unknown): string {
  const candidato =
    headerValue !== undefined && headerValue !== '' ? headerValue : bodyValue;

  if (candidato === undefined || candidato === null || candidato === '') {
    return crypto.randomUUID();
  }

  if (typeof candidato !== 'string') {
    throw new AppError(
      'A chave de idempotência deve ser um texto válido.',
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const trimmed = candidato.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > IDEMPOTENCY_KEY_MAX ||
    /[\r\n\x00-\x1f\x7f]/.test(trimmed)
  ) {
    throw new AppError(
      `A chave de idempotência deve ter entre 1 e ${IDEMPOTENCY_KEY_MAX} caracteres válidos.`,
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  return trimmed;
}

function extrairQuantidade(item: z.infer<typeof rawItemSchema>, pos: number): number {
  const temQuantidade = item.quantidade !== undefined;
  const temQuantity = item.quantity !== undefined;

  if (temQuantidade && temQuantity) {
    throw new AppError(
      `Item ${pos}: informe apenas "quantidade" ou "quantity".`,
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const valor = temQuantidade ? item.quantidade : item.quantity;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || !Number.isInteger(valor) || valor < 1) {
    throw new AppError(
      `Item ${pos}: a quantidade reservada deve ser um número inteiro maior ou igual a 1.`,
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  if (valor > INT4_MAX) {
    throw new AppError(
      `Item ${pos}: a quantidade excede o limite máximo permitido.`,
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  return valor;
}

function extrairPecaId(item: z.infer<typeof rawItemSchema>, pos: number): string {
  const temPecaId = item.pecaId !== undefined;
  const temProductId = item.productId !== undefined;

  if (temPecaId && temProductId) {
    throw new AppError(
      `Item ${pos}: informe apenas "pecaId" ou "productId".`,
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const rawId = temPecaId ? item.pecaId : item.productId;
  if (typeof rawId !== 'string' || rawId.trim().length === 0) {
    throw new AppError(
      `Item ${pos}: identificador da peça é obrigatório.`,
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const trimmed = rawId.trim();
  if (!isUuid(trimmed)) {
    throw new AppError(
      `A peça '${trimmed}' pertence ao catálogo legado sem controle transacional de estoque no PostgreSQL e não pode ser reservada.`,
      422,
      RESERVA_ERROR_CODES.PECA_NAO_PERSISTIDA,
    );
  }

  return trimmed.toLowerCase();
}

export function validarCriacaoReserva(
  body: unknown,
  idempotencyKeyHeader?: unknown,
): CriacaoReservaValidada {
  const parsedBody = rawBodySchema.safeParse(body);
  if (!parsedBody.success) {
    const mensagem = parsedBody.error.issues.map((i) => i.message).join('; ');
    throw new AppError(mensagem, 422, RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS);
  }

  const { itens, lines, idempotencyKey: bodyKey } = parsedBody.data;
  if (itens !== undefined && lines !== undefined) {
    throw new AppError(
      'Informe exclusivamente "itens" ou "lines" no corpo da reserva.',
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const listaBruta = itens !== undefined ? itens : lines;
  if (!Array.isArray(listaBruta) || listaBruta.length === 0) {
    throw new AppError(
      'Informe ao menos um item válido para reservar.',
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  if (listaBruta.length > MAX_ITENS_RESERVA) {
    throw new AppError(
      `A reserva permite no máximo ${MAX_ITENS_RESERVA} itens por requisição.`,
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const consolidado = new Map<string, number>();

  listaBruta.forEach((rawItem, idx) => {
    const pos = idx + 1;
    const itemParsed = rawItemSchema.safeParse(rawItem);
    if (!itemParsed.success) {
      const mensagem = itemParsed.error.issues.map((i) => i.message).join('; ');
      throw new AppError(`Item ${pos}: ${mensagem}`, 422, RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS);
    }

    const pecaId = extrairPecaId(itemParsed.data, pos);
    const quantidade = extrairQuantidade(itemParsed.data, pos);
    const acumulado = (consolidado.get(pecaId) ?? 0) + quantidade;

    if (acumulado > INT4_MAX) {
      throw new AppError(
        `A quantidade consolidada da peça '${pecaId}' excede o limite máximo permitido.`,
        422,
        RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
      );
    }

    consolidado.set(pecaId, acumulado);
  });

  // Ordenação determinística por pecaId antes de adquirir locks no banco (prevenção de deadlocks).
  const itensOrdenados: ItemReservaSolicitado[] = Array.from(consolidado.entries())
    .sort(([idA], [idB]) => (idA < idB ? -1 : idA > idB ? 1 : 0))
    .map(([pecaId, quantidade]) => ({ pecaId, quantidade }));

  const idempotencyKey = extrairIdempotencyKey(idempotencyKeyHeader, bodyKey);
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(itensOrdenados))
    .digest('hex');

  return {
    itens: itensOrdenados,
    idempotencyKey,
    payloadHash,
  };
}

export function validarUuidParam(valor: unknown, nomeCampo: string): string {
  if (typeof valor !== 'string' || !isUuid(valor.trim())) {
    throw new AppError(
      `${nomeCampo} inválido.`,
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }
  return valor.trim().toLowerCase();
}
