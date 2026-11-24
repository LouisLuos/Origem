import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

const CAMPO_ENDERECO_MAX = 150;
const NUMERO_MAX = 20;

export const ENDERECO_DADOS_INVALIDOS_CODE = 'ENDERECO_DADOS_INVALIDOS';

export const UFS_BRASIL = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

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
      ctx.addIssue({
        code: 'custom',
        message: `O complemento deve ter no máximo ${CAMPO_ENDERECO_MAX} caracteres.`,
      });
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
  if (!(UFS_BRASIL as readonly string[]).includes(uf)) {
    ctx.addIssue({ code: 'custom', message: 'Informe uma UF válida (por exemplo, PE).' });
    return z.NEVER;
  }
  return uf;
});

export const enderecoCompradorBodySchema = z.object(
  {
    cep: cepSchema,
    logradouro: texto('O logradouro é obrigatório.', 'O logradouro', CAMPO_ENDERECO_MAX),
    numero: texto('O número é obrigatório.', 'O número', NUMERO_MAX),
    complemento: complementoSchema,
    bairro: texto('O bairro é obrigatório.', 'O bairro', CAMPO_ENDERECO_MAX),
    cidade: texto('A cidade é obrigatória.', 'A cidade', CAMPO_ENDERECO_MAX),
    uf: ufSchema,
  },
  { error: 'O endereço deve ser enviado como um objeto JSON.' },
);

export type EnderecoCompradorDados = z.infer<typeof enderecoCompradorBodySchema>;

export function validarEnderecoComprador(input: unknown): EnderecoCompradorDados {
  const resultado = enderecoCompradorBodySchema.safeParse(input);
  if (!resultado.success) {
    throw new AppError(
      resultado.error.issues.map((issue) => issue.message).join('; '),
      422,
      ENDERECO_DADOS_INVALIDOS_CODE,
    );
  }
  return resultado.data;
}
