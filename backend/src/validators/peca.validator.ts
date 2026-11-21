import { z } from 'zod';
import { TIPOLOGIAS_HOMOLOGADAS, type TipologiaHomologada } from '../constants/taxonomy.js';
import type { TipoMimeFotoPeca } from '../repositories/contracts/pecas.contracts.js';
import { AppError } from '../utils/AppError.js';
import {
  FOTOS_PECA_MAX,
  FOTOS_PECA_MIN,
  FOTO_PECA_MAX_BASE64_CHARS,
  FOTO_PECA_MAX_BYTES,
  decodificarBase64Estrito,
  detectarTipoMimeImagem,
  isTipoMimeFotoPeca,
} from '../utils/fotoPeca.util.js';

/**
 * Validações de domínio da HU-05 (T-PEC-02, etapa 1): cubagem física e preço da peça.
 *
 * Escopo deliberadamente restrito às regras sem ambiguidade do backlog (Invariante 2):
 * peso embalado >= 50g, comprimento/largura/altura > 0 e preço > 0.
 *
 * Fora do escopo até decisão de modelagem: integralidade (int x decimal), casas decimais do
 * preço, limites máximos, coerção de strings (ex.: multipart na T-PEC-03), tipologia,
 * `is_fragil` e fotos.
 */

export const PESO_MINIMO_GRAMAS = 50;

export const MENSAGEM_PESO_MINIMO = 'O peso mínimo embalado para cotação de frete é 50g';

export const PECA_VALIDACAO_FISICA_CODE = 'PECA_VALIDACAO_FISICA';

interface RegraNumerica {
  readonly obrigatorio: string;
  readonly invalido: string;
  readonly aceita: (valor: number) => boolean;
  readonly violacao: string;
}

/**
 * Campo numérico obrigatório: aceita apenas `number` finito (rejeita ausente, null, string,
 * boolean, NaN e ±Infinity) e então aplica a regra de domínio.
 */
function campoNumericoObrigatorio(regra: RegraNumerica) {
  return z.unknown().transform((val, ctx): number => {
    if (val === undefined || val === null) {
      ctx.addIssue({ code: 'custom', message: regra.obrigatorio });
      return z.NEVER;
    }

    if (typeof val !== 'number' || !Number.isFinite(val)) {
      ctx.addIssue({ code: 'custom', message: regra.invalido });
      return z.NEVER;
    }

    if (!regra.aceita(val)) {
      ctx.addIssue({ code: 'custom', message: regra.violacao });
      return z.NEVER;
    }

    return val;
  });
}

function dimensaoPositiva(rotulo: string) {
  return campoNumericoObrigatorio({
    obrigatorio: `${rotulo} é obrigatório(a).`,
    invalido: `${rotulo} deve ser um número válido em centímetros.`,
    aceita: (valor) => valor > 0,
    violacao: `${rotulo} deve ser maior que zero.`,
  });
}

/**
 * Campos de cubagem e preço, reutilizáveis por schemas futuros de criação/edição de peça
 * (mesmo padrão de `paginationQueryFields`).
 */
export const cubagemPrecoFields = {
  pesoGramas: campoNumericoObrigatorio({
    obrigatorio: 'O peso embalado é obrigatório.',
    invalido: 'O peso embalado deve ser um número válido em gramas.',
    aceita: (valor) => valor >= PESO_MINIMO_GRAMAS,
    violacao: MENSAGEM_PESO_MINIMO,
  }),
  comprimentoCm: dimensaoPositiva('O comprimento'),
  larguraCm: dimensaoPositiva('A largura'),
  alturaCm: dimensaoPositiva('A altura'),
  preco: campoNumericoObrigatorio({
    obrigatorio: 'O preço é obrigatório.',
    invalido: 'O preço deve ser um número válido.',
    aceita: (valor) => valor > 0,
    violacao: 'O preço deve ser maior que zero.',
  }),
};

export const cubagemPrecoSchema = z.object(cubagemPrecoFields, {
  error: 'Os dados da peça devem ser enviados como um objeto JSON.',
});

export type CubagemPreco = z.infer<typeof cubagemPrecoSchema>;

/**
 * Valida cubagem e preço como regra de domínio. Violações geram `AppError` 422 (e não o 400
 * padrão do `errorHandler` para `ZodError`), preservando a mensagem oficial do peso mínimo.
 */
export function validarCubagemEPreco(input: unknown): CubagemPreco {
  const resultado = cubagemPrecoSchema.safeParse(input);

  if (!resultado.success) {
    const mensagem = resultado.error.issues.map((issue) => issue.message).join('; ');
    throw new AppError(mensagem, 422, PECA_VALIDACAO_FISICA_CODE);
  }

  return resultado.data;
}

/* -------------------------------------------------------------------------------------------- */
/* Criação de peça (HU-05, T-PEC-02): campos textuais, tipologia, fragilidade e fotos            */
/* -------------------------------------------------------------------------------------------- */

export const PECA_DADOS_INVALIDOS_CODE = 'PECA_DADOS_INVALIDOS';

/** Limites técnicos provisórios de texto (não definidos nos documentos normativos). */
export const TITULO_PECA_MAX = 150;
export const DESCRICAO_PECA_MAX = 5000;

export const MENSAGEM_FOTOS_MINIMAS = `A publicação exige no mínimo ${FOTOS_PECA_MIN} fotos da peça.`;

function textoObrigatorio(obrigatorio: string, rotulo: string, max: number) {
  return z.unknown().transform((val, ctx): string => {
    if (typeof val !== 'string' || val.trim().length === 0) {
      ctx.addIssue({ code: 'custom', message: obrigatorio });
      return z.NEVER;
    }
    const texto = val.trim();
    if (texto.length > max) {
      ctx.addIssue({ code: 'custom', message: `${rotulo} deve ter no máximo ${max} caracteres.` });
      return z.NEVER;
    }
    return texto;
  });
}

const tipologiaSchema = z.unknown().transform((val, ctx): TipologiaHomologada => {
  const tipologia = typeof val === 'string' ? val.trim() : val;
  if (!(TIPOLOGIAS_HOMOLOGADAS as readonly unknown[]).includes(tipologia)) {
    ctx.addIssue({
      code: 'custom',
      message: `Tipologia não homologada. Valores aceitos: ${TIPOLOGIAS_HOMOLOGADAS.join(', ')}.`,
    });
    return z.NEVER;
  }
  return tipologia as TipologiaHomologada;
});

/** `is_fragil` é obrigatório e explícito (T-PEC-02: bloquear cadastro sem flag de fragilidade). */
const isFragilSchema = z.unknown().transform((val, ctx): boolean => {
  if (typeof val !== 'boolean') {
    ctx.addIssue({
      code: 'custom',
      message: 'Informe se a peça é frágil (isFragil deve ser verdadeiro ou falso).',
    });
    return z.NEVER;
  }
  return val;
});

export interface FotoPecaValidada {
  readonly conteudo: Buffer;
  readonly tipoMime: TipoMimeFotoPeca;
  readonly tamanhoBytes: number;
}

function validarFoto(
  foto: unknown,
  posicao: number,
  ctx: { addIssue: (issue: { code: 'custom'; message: string }) => void },
): FotoPecaValidada | null {
  const prefixo = `Foto ${posicao}:`;
  if (typeof foto !== 'object' || foto === null || Array.isArray(foto)) {
    ctx.addIssue({ code: 'custom', message: `${prefixo} formato de envio inválido.` });
    return null;
  }

  const { tipoMime, conteudoBase64 } = foto as Record<string, unknown>;

  if (!isTipoMimeFotoPeca(tipoMime)) {
    ctx.addIssue({ code: 'custom', message: `${prefixo} formato não suportado (use JPEG ou PNG).` });
    return null;
  }

  if (typeof conteudoBase64 !== 'string' || conteudoBase64.length === 0) {
    ctx.addIssue({ code: 'custom', message: `${prefixo} conteúdo da imagem ausente.` });
    return null;
  }

  const limiteMb = FOTO_PECA_MAX_BYTES / (1024 * 1024);
  if (conteudoBase64.length > FOTO_PECA_MAX_BASE64_CHARS) {
    ctx.addIssue({ code: 'custom', message: `${prefixo} excede o tamanho máximo de ${limiteMb} MB.` });
    return null;
  }

  const conteudo = decodificarBase64Estrito(conteudoBase64);
  if (!conteudo) {
    ctx.addIssue({ code: 'custom', message: `${prefixo} conteúdo da imagem inválido.` });
    return null;
  }

  if (conteudo.length > FOTO_PECA_MAX_BYTES) {
    ctx.addIssue({ code: 'custom', message: `${prefixo} excede o tamanho máximo de ${limiteMb} MB.` });
    return null;
  }

  if (detectarTipoMimeImagem(conteudo) !== tipoMime) {
    ctx.addIssue({
      code: 'custom',
      message: `${prefixo} o conteúdo não corresponde a uma imagem ${tipoMime === 'image/png' ? 'PNG' : 'JPEG'} válida.`,
    });
    return null;
  }

  return { conteudo, tipoMime, tamanhoBytes: conteudo.length };
}

const fotosSchema = z.unknown().transform((val, ctx): FotoPecaValidada[] => {
  if (!Array.isArray(val) || val.length < FOTOS_PECA_MIN) {
    ctx.addIssue({ code: 'custom', message: MENSAGEM_FOTOS_MINIMAS });
    return z.NEVER;
  }
  if (val.length > FOTOS_PECA_MAX) {
    ctx.addIssue({ code: 'custom', message: `Envie no máximo ${FOTOS_PECA_MAX} fotos por peça.` });
    return z.NEVER;
  }

  const validadas: FotoPecaValidada[] = [];
  val.forEach((foto, index) => {
    const validada = validarFoto(foto, index + 1, ctx);
    if (validada) validadas.push(validada);
  });

  return validadas.length === val.length ? validadas : z.NEVER;
});

const indiceFotoPrincipalSchema = z.unknown().optional().transform((val, ctx): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'A foto principal deve ser indicada pela posição da foto (número inteiro a partir de 0).',
    });
    return z.NEVER;
  }
  return val;
});

export const criarPecaBodySchema = z
  .object(
    {
      titulo: textoObrigatorio('O título da peça é obrigatório.', 'O título', TITULO_PECA_MAX),
      descricao: textoObrigatorio('A descrição da peça é obrigatória.', 'A descrição', DESCRICAO_PECA_MAX),
      tipologia: tipologiaSchema,
      ...cubagemPrecoFields,
      isFragil: isFragilSchema,
      fotos: fotosSchema,
      indiceFotoPrincipal: indiceFotoPrincipalSchema,
    },
    { error: 'Os dados da peça devem ser enviados como um objeto JSON.' },
  )
  .transform((dados, ctx) => {
    if (dados.indiceFotoPrincipal >= dados.fotos.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'A foto principal indicada não corresponde a nenhuma das fotos enviadas.',
      });
      return z.NEVER;
    }
    return dados;
  });

export type CriarPecaDados = z.infer<typeof criarPecaBodySchema>;

/**
 * Valida o corpo completo de criação de peça. Qualquer violação gera `AppError` 422; quando a
 * única violação é o peso, a mensagem é exatamente a oficial da HU-05.
 */
export function validarCriacaoPeca(input: unknown): CriarPecaDados {
  const resultado = criarPecaBodySchema.safeParse(input);
  if (!resultado.success) {
    const mensagem = resultado.error.issues.map((issue) => issue.message).join('; ');
    throw new AppError(mensagem, 422, PECA_DADOS_INVALIDOS_CODE);
  }
  return resultado.data;
}
