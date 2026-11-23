import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { filaEmailRecuperacaoSenha } from '../integrations/emailRecuperacaoSenha.queue.js';
import type { PasswordHasher } from '../repositories/contracts/authentication.contracts.js';
import type {
  EnvioEmailRecuperacao,
  RecuperacaoSenhaRepository,
} from '../repositories/contracts/hu02.contracts.js';
import { prismaRecuperacaoSenhaRepository } from '../repositories/prismaRecuperacaoSenha.repository.js';
import { AppError } from '../utils/AppError.js';
import { passwordHasher as defaultPasswordHasher } from '../utils/password.util.js';

/** HU-02, Cenário 1. */
export const VALIDADE_TOKEN_RECUPERACAO_MINUTOS = 30;

export const MENSAGEM_SOLICITACAO_RECUPERACAO =
  'Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.';

export function hashTokenRecuperacao(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface RecuperacaoSenhaServiceDeps {
  readonly repository?: RecuperacaoSenhaRepository;
  readonly envioEmail?: EnvioEmailRecuperacao;
  readonly passwordHasher?: PasswordHasher;
  readonly now?: () => Date;
  readonly gerarToken?: () => string;
  readonly urlPublica?: string;
}

export interface RecuperacaoSenhaService {
  solicitar(email: string): Promise<void>;
  redefinir(token: string, novaSenha: string): Promise<void>;
}

export function createRecuperacaoSenhaService(
  deps: RecuperacaoSenhaServiceDeps = {},
): RecuperacaoSenhaService {
  const repository = deps.repository ?? prismaRecuperacaoSenhaRepository;
  const envioEmail = deps.envioEmail ?? filaEmailRecuperacaoSenha;
  const passwordHasher = deps.passwordHasher ?? defaultPasswordHasher;
  const now = deps.now ?? (() => new Date());
  const gerarToken = deps.gerarToken ?? (() => randomBytes(32).toString('base64url'));
  const urlPublica = deps.urlPublica ?? env.APP_PUBLIC_URL;

  return {
    async solicitar(email) {
      const usuario = await repository.buscarUsuarioAtivoPorEmail(email.trim().toLowerCase());
      if (!usuario) return;

      const token = gerarToken();
      const agora = now();
      const expiraEm = new Date(agora.getTime() + VALIDADE_TOKEN_RECUPERACAO_MINUTOS * 60_000);
      const { id } = await repository.registrarSolicitacao({
        usuarioId: usuario.id,
        tokenHash: hashTokenRecuperacao(token),
        expiraEm,
        agora,
      });

      const url = new URL('/redefinir-senha', urlPublica);
      url.searchParams.set('token', token);
      await envioEmail.enfileirar({
        recuperacaoId: id,
        usuario,
        urlRedefinicao: url.toString(),
        validadeMinutos: VALIDADE_TOKEN_RECUPERACAO_MINUTOS,
      });
    },

    async redefinir(token, novaSenha) {
      const resultado = await repository.redefinirSenha({
        tokenHash: hashTokenRecuperacao(token),
        senhaHash: await passwordHasher.hash(novaSenha),
        agora: now(),
      });
      if (resultado === 'TOKEN_INVALIDO') {
        throw new AppError(
          'Este link de recuperação é inválido, já foi usado ou expirou. Solicite um novo link.',
          400,
          'TOKEN_RECUPERACAO_INVALIDO',
        );
      }
    },
  };
}

export const recuperacaoSenhaService = createRecuperacaoSenhaService();
