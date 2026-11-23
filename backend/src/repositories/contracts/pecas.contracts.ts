/**
 * Contratos de domínio e de infraestrutura para catalogação de peças com cubagem e fotos.
 *
 * Referências normativas:
 * - references/backlog-priorizado-origem.md
 * - references/modelagem-inicial-origem.sql (tabelas `pecas`, `fotos_peca`, enum `StatusPeca`)
 *
 * PENDÊNCIAS COM A EQUIPE DE BANCO — NÃO IMPLEMENTADAS AQUI:
 * - [P1] Tabelas `pecas` e `fotos_peca` inexistentes no PostgreSQL; dependem de `atelies`.
 * - [P2] Tipo das PKs (o banco real usa UUID; o SQL de referência usa INT IDENTITY). Identificadores
 *        trafegam aqui como string para não acoplar a decisão.
 * - [P3] Constraints CHECK: peso_gramas >= 50, comprimento/largura/altura > 0, preco > 0.
 * - [P4] Peça e fotos devem ser gravadas na mesma transação (`prisma.$transaction`).
 * - [P5] RLS/privilégios de `anon`/`authenticated` nas novas tabelas.
 */

export type StatusPeca = 'DISPONIVEL' | 'RESERVADA' | 'VENDIDA' | 'ARQUIVADA';

export type TipoMimeFotoPeca = 'image/jpeg' | 'image/png';

/** Dados de uma foto já armazenada, prontos para associação em `fotos_peca`. */
export interface FotoPecaParaPersistir {
  readonly url: string;
  readonly caminhoArmazenamento: string;
  readonly isPrincipal: boolean;
}

/** Entrada de persistência atômica de uma peça com suas fotos. */
export interface CriarPecaPersistenciaInput {
  readonly atelieId: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly tipologia: string;
  readonly preco: number;
  readonly pesoGramas: number;
  readonly comprimentoCm: number;
  readonly larguraCm: number;
  readonly alturaCm: number;
  readonly isFragil: boolean;
  readonly status: StatusPeca;
  readonly fotos: readonly FotoPecaParaPersistir[];
}

export interface FotoPecaPersistida {
  readonly id: string;
  readonly url: string;
  readonly isPrincipal: boolean;
}

export interface PecaPersistida {
  readonly id: string;
  readonly atelieId: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly tipologia: string;
  readonly preco: number;
  readonly pesoGramas: number;
  readonly comprimentoCm: number;
  readonly larguraCm: number;
  readonly alturaCm: number;
  readonly isFragil: boolean;
  readonly status: StatusPeca;
  readonly fotos: readonly FotoPecaPersistida[];
}

/**
 * Contrato de persistência de peças.
 * A implementação real deve gravar `pecas` e `fotos_peca` em uma única transação (pendência P4).
 */
export interface PecaRepository {
  criarComFotos(dados: CriarPecaPersistenciaInput): Promise<PecaPersistida>;
}

/** Imagem já otimizada para a web. */
export interface ImagemOtimizada {
  readonly conteudo: Buffer;
  readonly tipoMime: string;
  readonly extensao: string;
}

/**
 * Contrato de processamento e otimização das fotos.
 * PENDÊNCIA: biblioteca ou serviço de otimização ainda não aprovado.
 */
export interface ProcessadorImagemPeca {
  otimizar(imagem: { readonly conteudo: Buffer; readonly tipoMime: TipoMimeFotoPeca }): Promise<ImagemOtimizada>;
}

export interface ArquivoArmazenado {
  readonly url: string;
  readonly caminho: string;
}

/**
 * Contrato de armazenamento das fotos.
 * PENDÊNCIA: bucket, políticas e credenciais do Supabase Storage (ou outro provedor) não configurados.
 */
export interface ArmazenamentoFotosPeca {
  salvar(arquivo: {
    readonly atelieId: string;
    readonly conteudo: Buffer;
    readonly tipoMime: string;
    readonly extensao: string;
  }): Promise<ArquivoArmazenado>;
  remover(caminhos: readonly string[]): Promise<void>;
}
