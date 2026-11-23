import {
  FRETE_ERROR_CODES,
  type SimularFretePecaInput,
} from '../repositories/contracts/frete.contracts.js';
import { AppError } from '../utils/AppError.js';

const CEP_FORMATADO_REGEX = /^\d{5}-?\d{3}$/;

export function normalizarCep(valor: unknown, nomeCampo = 'cepDestino'): string {
  if (typeof valor !== 'string') {
    throw new AppError(
      `O campo '${nomeCampo}' é obrigatório e deve conter um CEP válido de 8 dígitos.`,
      400,
      FRETE_ERROR_CODES.FRETE_DADOS_INVALIDOS,
    );
  }

  const trimmed = valor.trim();
  if (!CEP_FORMATADO_REGEX.test(trimmed)) {
    throw new AppError(
      `O campo '${nomeCampo}' deve estar no formato 00000-000 ou 00000000.`,
      400,
      FRETE_ERROR_CODES.FRETE_DADOS_INVALIDOS,
    );
  }

  const digitos = trimmed.replace(/\D/g, '');
  if (digitos === '00000000') {
    throw new AppError(
      `O CEP informado em '${nomeCampo}' é inválido.`,
      400,
      FRETE_ERROR_CODES.FRETE_DADOS_INVALIDOS,
    );
  }

  return digitos;
}

/**
 * Valida o payload de `POST /api/v1/frete/simular` (HU-07 Cenário 3).
 * Aceita `pecaId` (ou aliases `produtoId` / `productId`) e `cepDestino` (ou alias `cep`).
 */
export function validarSimulacaoFreteInput(body: unknown): SimularFretePecaInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(
      'Corpo da requisição inválido para simulação de frete.',
      400,
      FRETE_ERROR_CODES.FRETE_DADOS_INVALIDOS,
    );
  }

  const registro = body as Record<string, unknown>;
  const rawPecaId = registro.pecaId ?? registro.produtoId ?? registro.productId;

  if (typeof rawPecaId !== 'string' || rawPecaId.trim() === '') {
    throw new AppError(
      "O campo 'pecaId' (ou 'produtoId') é obrigatório.",
      400,
      FRETE_ERROR_CODES.FRETE_DADOS_INVALIDOS,
    );
  }

  const rawCep = registro.cepDestino ?? registro.cep;
  const cepDestino = normalizarCep(rawCep, 'cepDestino');

  return {
    pecaId: rawPecaId.trim(),
    cepDestino,
  };
}

