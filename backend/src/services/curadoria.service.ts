import { resolveAtelierContext } from '../middlewares/rbac.middleware.js';
import {
  PERMISSOES_CURADOR_ATELIE,
  type AtelieAutorizacaoRepository,
  type ContextoAcessoAtelie,
  type CuradorVinculoPersistido,
  type CuradorVinculoRepository,
  type OperacaoAtelie,
} from '../repositories/contracts/hu03.contracts.js';
import {
  unconfiguredAtelieAutorizacaoRepository,
  unconfiguredCuradorVinculoRepository,
} from '../repositories/unconfiguredHu03.repository.js';
import { AppError } from '../utils/AppError.js';
import type { AssociarCuradorValidatedInput } from '../validators/hu03.validator.js';

export interface CuradorVinculoPublico {
  readonly vinculoId: string;
  readonly atelieId: string;
  readonly usuarioId: string;
  readonly nome: string;
  readonly email: string;
  readonly papelNoAtelie: 'CURADOR';
  readonly permissoes: readonly OperacaoAtelie[];
  readonly criadoEm: string;
}

export interface CuradoriaService {
  listarMeusVinculos(usuarioId: string): Promise<ContextoAcessoAtelie[]>;
  listarCuradores(atelieId: string): Promise<CuradorVinculoPublico[]>;
  associarCurador(
    atelieId: string,
    titularUsuarioId: string,
    input: AssociarCuradorValidatedInput,
  ): Promise<CuradorVinculoPublico>;
  removerCurador(
    atelieId: string,
    titularUsuarioId: string,
    curadorUsuarioId: string,
  ): Promise<void>;
}

export interface CuradoriaServiceDeps {
  readonly curadorRepository?: CuradorVinculoRepository;
  readonly autorizacaoRepository?: AtelieAutorizacaoRepository;
}

function toCuradorVinculoPublico(vinculo: CuradorVinculoPersistido): CuradorVinculoPublico {
  return {
    vinculoId: vinculo.vinculoId,
    atelieId: vinculo.atelieId,
    usuarioId: vinculo.usuarioId,
    nome: vinculo.nome,
    email: vinculo.email,
    papelNoAtelie: 'CURADOR',
    permissoes: PERMISSOES_CURADOR_ATELIE,
    criadoEm: vinculo.criadoEm,
  };
}

export function createCuradoriaService(deps?: CuradoriaServiceDeps): CuradoriaService {
  const curadorRepository = deps?.curadorRepository ?? unconfiguredCuradorVinculoRepository;
  const autorizacaoRepository =
    deps?.autorizacaoRepository ?? unconfiguredAtelieAutorizacaoRepository;

  return {
    async listarMeusVinculos(usuarioId: string): Promise<ContextoAcessoAtelie[]> {
      const relacionamentos = await autorizacaoRepository.listRelacionamentosUsuario(usuarioId);
      const contextos: ContextoAcessoAtelie[] = [];

      for (const rel of relacionamentos) {
        const ctx = resolveAtelierContext(rel);
        if (ctx) {
          contextos.push(ctx);
        }
      }

      return contextos;
    },

    async listarCuradores(atelieId: string): Promise<CuradorVinculoPublico[]> {
      const vinculos = await curadorRepository.listVinculosPorAtelie(atelieId);
      return vinculos.map(toCuradorVinculoPublico);
    },

    async associarCurador(
      atelieId: string,
      titularUsuarioId: string,
      input: AssociarCuradorValidatedInput,
    ): Promise<CuradorVinculoPublico> {
      const usuarioAlvo = await curadorRepository.findUsuarioPorEmail(input.email);
      if (!usuarioAlvo) {
        throw new AppError('Nenhum usuário encontrado com o e-mail informado.', 404);
      }

      if (usuarioAlvo.status !== 'ATIVO') {
        throw new AppError(
          'Apenas usuários ativos na plataforma podem ser vinculados como curadores.',
          422,
        );
      }

      if (usuarioAlvo.id === titularUsuarioId) {
        throw new AppError(
          'O artesão titular não pode se associar como curador do próprio ateliê.',
          422,
        );
      }

      const existente = await curadorRepository.findVinculo(atelieId, usuarioAlvo.id);
      if (existente) {
        throw new AppError('Este usuário já está vinculado como curador deste ateliê.', 409);
      }

      const criado = await curadorRepository.vincularCuradorNoAtelie(atelieId, usuarioAlvo.id);
      return toCuradorVinculoPublico(criado);
    },

    async removerCurador(
      atelieId: string,
      titularUsuarioId: string,
      curadorUsuarioId: string,
    ): Promise<void> {
      if (curadorUsuarioId === titularUsuarioId) {
        throw new AppError(
          'Não é possível remover o próprio titular pela rota de desvincular curador.',
          422,
        );
      }

      const removido = await curadorRepository.desvincularCuradorDoAtelie(
        atelieId,
        curadorUsuarioId,
      );
      if (!removido) {
        throw new AppError('Vínculo de curador não encontrado neste ateliê.', 404);
      }
    },
  };
}

export const curadoriaService: CuradoriaService = createCuradoriaService();
