import { z } from 'zod';
import { POLOS_CULTURAIS_HOMOLOGADOS, type PoloCulturalHomologado } from '../constants/taxonomy.js';
import { AppError } from '../utils/AppError.js';

/** Limites técnicos de texto (não definidos nos documentos normativos). */
const NOME_COMERCIAL_MAX = 120;
const CAMPO_ENDERECO_MAX = 150;

export const ATELIE_DADOS_INVALIDOS_CODE = 'ATELIE_DADOS_INVALIDOS';

function texto(obrigatorio: string, rotulo: string, max: number) {
  return z.unknown().transform((val, ctx): string => {
    if (typeof val !== 'string' || val.trim().length === 0) {
      ctx.addIssue({ code: 'custom', message: obrigatorio });
      return z.NEVER;
    }
    const valor = val.trim();
    if (valor.length > max) {
      ctx.addIssue({ code: 'custom', message: `${rotulo} deve ter no máximo ${max} caracteres.` });
      return z.NEVER;
    }
    return valor;
  });
}

const complementoSchema = z
  .unknown()
  .optional()
  .transform((val, ctx): string | undefined => {
    if (val === undefined || val === null) return undefined;
    if (typeof val !== 'string') {
      ctx.addIssue({ code: 'custom', message: 'O complemento deve ser um texto.' });
      return z.NEVER;
    }
    const valor = val.trim();
    if (valor.length > CAMPO_ENDERECO_MAX) {
      ctx.addIssue({ code: 'custom', message: `O complemento deve ter no máximo ${CAMPO_ENDERECO_MAX} caracteres.` });
      return z.NEVER;
    }
    return valor.length > 0 ? valor : undefined;
  });

const cepSchema = z.unknown().transform((val, ctx): string => {
  const digitos = typeof val === 'string' ? val.replace(/\D/g, '') : '';
  if (digitos.length !== 8) {
    ctx.addIssue({ code: 'custom', message: 'Informe um CEP válido com 8 dígitos.' });
    return z.NEVER;
  }
  return digitos;
});

const ufSchema = z.unknown().transform((val, ctx): string => {
  const uf = typeof val === 'string' ? val.trim().toUpperCase() : '';
  if (uf !== 'PE') {
    ctx.addIssue({ code: 'custom', message: 'O endereço de expedição deve ser em Pernambuco (UF PE).' });
    return z.NEVER;
  }
  return uf;
});

const poloSchema = z.unknown().transform((val, ctx): PoloCulturalHomologado => {
  const polo = typeof val === 'string' ? val.trim() : val;
  if (!(POLOS_CULTURAIS_HOMOLOGADOS as readonly unknown[]).includes(polo)) {
    ctx.addIssue({
      code: 'custom',
      message: `Polo cultural não homologado. Valores aceitos: ${POLOS_CULTURAIS_HOMOLOGADOS.join(', ')}.`,
    });
    return z.NEVER;
  }
  return polo as PoloCulturalHomologado;
});

export const criarAtelieBodySchema = z.object(
  {
    nomeComercial: texto('O nome comercial do ateliê é obrigatório.', 'O nome comercial', NOME_COMERCIAL_MAX),
    poloCultural: poloSchema,
    endereco: z.object(
      {
        cep: cepSchema,
        logradouro: texto('O logradouro é obrigatório.', 'O logradouro', CAMPO_ENDERECO_MAX),
        numero: texto('O número é obrigatório.', 'O número', 20),
        complemento: complementoSchema,
        bairro: texto('O bairro é obrigatório.', 'O bairro', CAMPO_ENDERECO_MAX),
        cidade: texto('A cidade é obrigatória.', 'A cidade', CAMPO_ENDERECO_MAX),
        uf: ufSchema,
      },
      { error: 'Informe o endereço de expedição do ateliê.' },
    ),
  },
  { error: 'Os dados do ateliê devem ser enviados como um objeto JSON.' },
);

export const atualizarAtelieBodySchema = criarAtelieBodySchema;

export type CriarAtelieDados = z.infer<typeof criarAtelieBodySchema>;
export type AtualizarAtelieDados = z.infer<typeof atualizarAtelieBodySchema>;

export function validarCriacaoAtelie(input: unknown): CriarAtelieDados {
  const resultado = criarAtelieBodySchema.safeParse(input);
  if (!resultado.success) {
    throw new AppError(
      resultado.error.issues.map((issue) => issue.message).join('; '),
      422,
      ATELIE_DADOS_INVALIDOS_CODE,
    );
  }
  return resultado.data;
}

export function validarAtualizacaoAtelie(input: unknown): AtualizarAtelieDados {
  const resultado = atualizarAtelieBodySchema.safeParse(input);
  if (!resultado.success) {
    throw new AppError(
      resultado.error.issues.map((issue) => issue.message).join('; '),
      422,
      ATELIE_DADOS_INVALIDOS_CODE,
    );
  }
  return resultado.data;
}
