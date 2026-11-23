import type {
  HabilitacaoArtesaoRepository,
  TipoChavePix,
} from '../repositories/contracts/hu03.contracts.js';
import { unconfiguredHabilitacaoArtesaoRepository } from '../repositories/unconfiguredHu03.repository.js';
import { prismaHabilitacaoArtesaoRepository } from '../repositories/prismaHu03.repository.js';
import { AppError } from '../utils/AppError.js';
import { pixCryptoService, type PixCryptoService } from '../utils/pixCrypto.util.js';
import type { HabilitarArtesaoValidatedInput } from '../validators/hu03.validator.js';
import { buildPixKeyAad } from './atelieFinanceiro.service.js';

export interface HabilitacaoArtesaoResultado {
  readonly artesaoId: string;
  readonly usuarioId: string;
  readonly biografiaCultural: string;
  readonly papelAssociado: 'ARTESAO';
  readonly chavePix: {
    readonly tipo: TipoChavePix;
    readonly mascarada: string;
    readonly verificacaoDict: 'NAO_VERIFICADA_LOCALMENTE';
  };
  readonly criadoEm?: string;
}

export interface HabilitacaoArtesaoService {
  habilitar(
    usuarioId: string,
    input: HabilitarArtesaoValidatedInput,
  ): Promise<HabilitacaoArtesaoResultado>;
}

export interface HabilitacaoArtesaoServiceDeps {
  readonly repository?: HabilitacaoArtesaoRepository;
  readonly cryptoService?: PixCryptoService;
}

/**
 * Orquestra a habilitação de artesão titular, protegendo a Chave Pix com
 * AES-256-GCM e respeitando a fronteira da  (não cria registro de ateliê aqui).
 */
export function createHabilitacaoArtesaoService(
  deps?: HabilitacaoArtesaoServiceDeps,
): HabilitacaoArtesaoService {
  const repository = deps?.repository ?? unconfiguredHabilitacaoArtesaoRepository;
  const cryptoService = deps?.cryptoService ?? pixCryptoService;

  return {
    async habilitar(
      usuarioId: string,
      input: HabilitarArtesaoValidatedInput,
    ): Promise<HabilitacaoArtesaoResultado> {
      const usuario = await repository.findUsuarioPorId(usuarioId);
      if (!usuario) {
        throw new AppError('Usuário autenticado não encontrado.', 404);
      }

      if (usuario.status !== 'ATIVO') {
        throw new AppError(
          'Apenas usuários com conta ativa podem solicitar habilitação como artesão titular.',
          422,
        );
      }

      const existente = await repository.findArtesaoPorUsuarioId(usuarioId);
      if (existente) {
        throw new AppError('Este usuário já possui perfil de artesão titular habilitado.', 409);
      }

      const chavePixCriptografada = cryptoService.encrypt(
        input.chavePixNormalizada,
        buildPixKeyAad(usuarioId),
      );

      const criado = await repository.habilitarArtesaoComPapel({
        usuarioId,
        biografiaCultural: input.biografiaCultural,
        tipoChavePix: input.tipoChavePix,
        chavePixCriptografada,
      });

      return {
        artesaoId: criado.id,
        usuarioId: criado.usuarioId,
        biografiaCultural: criado.biografiaCultural,
        papelAssociado: 'ARTESAO',
        chavePix: {
          tipo: input.tipoChavePix,
          mascarada: input.chavePixMascarada,
          verificacaoDict: 'NAO_VERIFICADA_LOCALMENTE',
        },
        ...(criado.criadoEm ? { criadoEm: criado.criadoEm } : {}),
      };
    },
  };
}

export const habilitacaoArtesaoService: HabilitacaoArtesaoService = createHabilitacaoArtesaoService({
  repository: prismaHabilitacaoArtesaoRepository,
});
