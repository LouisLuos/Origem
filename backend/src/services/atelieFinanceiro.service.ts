import type {
  AtelieFinanceiroRepository,
  TipoChavePix,
} from '../repositories/contracts/hu03.contracts.js';
import {
  HU03_ERROR_CODES,
  unconfiguredAtelieFinanceiroRepository,
} from '../repositories/unconfiguredHu03.repository.js';
import { AppError } from '../utils/AppError.js';
import {
  PIX_CRYPTO_ERROR_CODES,
  pixCryptoService,
  type PixCryptoService,
} from '../utils/pixCrypto.util.js';
import { detectPixKeyType, maskPixKey } from '../utils/pixKey.util.js';
import type { AtualizarChavePixValidatedInput } from '../validators/hu03.validator.js';

export interface ResumoFinanceiroAtelieResultado {
  readonly atelieId: string;
  readonly artesaoId: string;
  readonly chavePix: {
    readonly cadastrada: true;
    readonly tipo: TipoChavePix;
    readonly mascarada: string;
    readonly verificacaoDict: 'NAO_VERIFICADA_LOCALMENTE';
  };
  readonly atualizadoEm?: string;
}

export interface AtualizacaoChavePixResultado {
  readonly atelieId: string;
  readonly artesaoId: string;
  readonly chavePix: {
    readonly tipo: TipoChavePix;
    readonly mascarada: string;
    readonly verificacaoDict: 'NAO_VERIFICADA_LOCALMENTE';
  };
  readonly atualizadoEm: string;
}

export interface AtelieFinanceiroService {
  consultarResumoFinanceiro(atelieId: string): Promise<ResumoFinanceiroAtelieResultado>;
  atualizarChavePix(
    atelieId: string,
    titularUsuarioId: string,
    input: AtualizarChavePixValidatedInput,
  ): Promise<AtualizacaoChavePixResultado>;
}

export interface AtelieFinanceiroServiceDeps {
  readonly repository?: AtelieFinanceiroRepository;
  readonly cryptoService?: PixCryptoService;
}

/**
 * AAD vinculado ao identificador do usuário titular para impedir troca de ciphertexts
 * entre registros distintos e manter consistência entre habilitação e atualização no ateliê.
 */
export function buildPixKeyAad(titularUsuarioId: string): string {
  return `origem:pix:v1:usuario:${titularUsuarioId}`;
}

export function createAtelieFinanceiroService(
  deps?: AtelieFinanceiroServiceDeps,
): AtelieFinanceiroService {
  const repository = deps?.repository ?? unconfiguredAtelieFinanceiroRepository;
  const cryptoService = deps?.cryptoService ?? pixCryptoService;

  return {
    async consultarResumoFinanceiro(atelieId: string): Promise<ResumoFinanceiroAtelieResultado> {
      const dados = await repository.findDadosFinanceirosPorAtelie(atelieId);
      if (!dados) {
        throw new AppError('Dados financeiros do ateliê não encontrados.', 404);
      }

      const plaintext = cryptoService.decrypt(
        dados.chavePixCriptografada,
        buildPixKeyAad(dados.titularUsuarioId),
      );
      const resolvedType = dados.tipoChavePix ?? detectPixKeyType(plaintext);

      if (!resolvedType) {
        throw new AppError(
          'Não foi possível validar o tipo da Chave Pix armazenada.',
          500,
          PIX_CRYPTO_ERROR_CODES.FALHA_DESCRIPTOGRAFIA,
        );
      }

      return {
        atelieId: dados.atelieId,
        artesaoId: dados.artesaoId,
        chavePix: {
          cadastrada: true,
          tipo: resolvedType,
          mascarada: maskPixKey(plaintext, resolvedType),
          verificacaoDict: 'NAO_VERIFICADA_LOCALMENTE',
        },
        ...(dados.atualizadoEm ? { atualizadoEm: dados.atualizadoEm } : {}),
      };
    },

    async atualizarChavePix(
      atelieId: string,
      titularUsuarioId: string,
      input: AtualizarChavePixValidatedInput,
    ): Promise<AtualizacaoChavePixResultado> {
      const atual = await repository.findDadosFinanceirosPorAtelie(atelieId);
      if (!atual) {
        throw new AppError('Ateliê ou perfil financeiro não encontrado.', 404);
      }

      if (atual.titularUsuarioId !== titularUsuarioId) {
        throw new AppError(
          'Acesso financeiro negado: titularidade inconsistente para este ateliê.',
          403,
          HU03_ERROR_CODES.ACESSO_FINANCEIRO_BLOQUEADO,
        );
      }

      const chavePixCriptografada = cryptoService.encrypt(
        input.chavePixNormalizada,
        buildPixKeyAad(titularUsuarioId),
      );

      const atualizado = await repository.atualizarChavePixCriptografada(
        atelieId,
        chavePixCriptografada,
        input.tipoChavePix,
      );

      return {
        atelieId: atualizado.atelieId,
        artesaoId: atualizado.artesaoId,
        chavePix: {
          tipo: atualizado.tipoChavePix,
          mascarada: input.chavePixMascarada,
          verificacaoDict: 'NAO_VERIFICADA_LOCALMENTE',
        },
        atualizadoEm: atualizado.atualizadoEm,
      };
    },
  };
}

export const atelieFinanceiroService: AtelieFinanceiroService = createAtelieFinanceiroService();
