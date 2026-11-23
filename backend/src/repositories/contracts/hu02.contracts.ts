export interface UsuarioRecuperacao {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
}

export interface RegistrarSolicitacaoInput {
  readonly usuarioId: string;
  readonly tokenHash: string;
  readonly expiraEm: Date;
  readonly agora: Date;
}

export interface RedefinirSenhaInput {
  readonly tokenHash: string;
  readonly senhaHash: string;
  readonly agora: Date;
}

export type ResultadoRedefinicao = 'REDEFINIDA' | 'TOKEN_INVALIDO';

export interface RecuperacaoSenhaRepository {
  buscarUsuarioAtivoPorEmail(email: string): Promise<UsuarioRecuperacao | null>;
  /** Invalida os tokens pendentes do usuário e grava o novo, na mesma transação. */
  registrarSolicitacao(input: RegistrarSolicitacaoInput): Promise<{ readonly id: string }>;
  /**
   * Na mesma transação: consome o token (uso único), grava a nova senha, invalida os demais
   * tokens pendentes e marca `sessoes_validas_desde`, encerrando as sessões anteriores.
   */
  redefinirSenha(input: RedefinirSenhaInput): Promise<ResultadoRedefinicao>;
}

export interface EmailRecuperacaoInput {
  readonly recuperacaoId: string;
  readonly usuario: UsuarioRecuperacao;
  readonly urlRedefinicao: string;
  readonly validadeMinutos: number;
}

export interface EnvioEmailRecuperacao {
  enfileirar(input: EmailRecuperacaoInput): Promise<void>;
}
