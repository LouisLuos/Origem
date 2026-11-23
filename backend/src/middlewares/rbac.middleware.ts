import type { NextFunction, Request, Response } from 'express';
import {
  PERMISSOES_CURADOR_ATELIE,
  PERMISSOES_TITULAR_ATELIE,
  type AtelieAutorizacaoRepository,
  type ContextoAcessoAtelie,
  type OperacaoAtelie,
  type RelacionamentoUsuarioAtelie,
} from '../repositories/contracts/hu03.contracts.js';
import {
  ATELIE_ERROR_CODES,
  unconfiguredAtelieAutorizacaoRepository,
} from '../repositories/unconfiguredHu03.repository.js';
import { AppError } from '../utils/AppError.js';
import {
  securityAuditService,
  type SecurityAuditReason,
  type SecurityAuditService,
} from '../utils/securityAudit.util.js';
import { atelieIdParamSchema } from '../validators/hu03.validator.js';
import { resolveCorrelationId } from './requestLogger.js';

export type AtelierAccessDecision =
  | { readonly allowed: true; readonly context: ContextoAcessoAtelie }
  | {
      readonly allowed: false;
      readonly reason: SecurityAuditReason;
      readonly errorCode: string;
      readonly message: string;
    };

export interface AtelierRbacDependencies {
  readonly autorizacaoRepository?: AtelieAutorizacaoRepository;
  readonly auditService?: SecurityAuditService;
}

const FINANCIAL_OPERATIONS: ReadonlySet<OperacaoAtelie> = new Set([
  'ALTERAR_CHAVE_PIX',
  'CONSULTAR_DADOS_FINANCEIROS',
]);

/**
 * Converte o relacionamento bruto do banco no contexto autorizado do usuário para um ateliê.
 */
export function resolveAtelierContext(
  relacionamento: RelacionamentoUsuarioAtelie,
): ContextoAcessoAtelie | null {
  if (relacionamento.ehTitular) {
    return {
      atelieId: relacionamento.atelieId,
      ...(relacionamento.nomeComercial !== undefined
        ? { nomeComercial: relacionamento.nomeComercial }
        : {}),
      statusAtelie: relacionamento.statusAtelie,
      papelNoAtelie: 'TITULAR',
      permissoes: PERMISSOES_TITULAR_ATELIE,
    };
  }

  if (relacionamento.ehCuradorVinculado) {
    return {
      atelieId: relacionamento.atelieId,
      ...(relacionamento.nomeComercial !== undefined
        ? { nomeComercial: relacionamento.nomeComercial }
        : {}),
      statusAtelie: relacionamento.statusAtelie,
      papelNoAtelie: 'CURADOR',
      permissoes: relacionamento.statusAtelie === 'ATIVO' ? PERMISSOES_CURADOR_ATELIE : [],
    };
  }

  return null;
}

/**
 * Avalia a matriz RBAC contextual com negação por padrão:
 * - Operações financeiras e gestão de curadores exigem titularidade do ateliê específico.
 * - Operações de catálogo e etiquetas aceitam titular ou curador vinculado em ateliê ATIVO.
 */
export function evaluateAtelierAccess(
  relacionamento: RelacionamentoUsuarioAtelie | null,
  operacao: OperacaoAtelie,
): AtelierAccessDecision {
  const isFinancial = FINANCIAL_OPERATIONS.has(operacao);
  const context = relacionamento ? resolveAtelierContext(relacionamento) : null;

  if (!relacionamento || !context) {
    return {
      allowed: false,
      reason: 'NO_ATELIER_LINK',
      errorCode: isFinancial
        ? ATELIE_ERROR_CODES.ACESSO_FINANCEIRO_BLOQUEADO
        : ATELIE_ERROR_CODES.ACESSO_ATELIE_NEGADO,
      message: isFinancial
        ? 'Acesso financeiro negado: usuário não possui titularidade neste ateliê.'
        : 'Acesso negado: usuário não possui vínculo com este ateliê.',
    };
  }

  switch (operacao) {
    case 'ALTERAR_CHAVE_PIX':
    case 'CONSULTAR_DADOS_FINANCEIROS':
      if (relacionamento.ehTitular) {
        return { allowed: true, context };
      }
      return {
        allowed: false,
        reason: 'CURATOR_FINANCIAL_BLOCK',
        errorCode: ATELIE_ERROR_CODES.ACESSO_FINANCEIRO_BLOQUEADO,
        message:
          'Acesso financeiro negado: curadores não têm permissão para consultar ou alterar a Chave Pix do ateliê.',
      };

    case 'GERENCIAR_CURADORES':
      if (relacionamento.ehTitular) {
        return { allowed: true, context };
      }
      return {
        allowed: false,
        reason: 'CURATOR_GOVERNANCE_BLOCK',
        errorCode: ATELIE_ERROR_CODES.ACESSO_ATELIE_NEGADO,
        message: 'Operação negada: apenas o artesão titular pode gerenciar os curadores do ateliê.',
      };

    case 'EDITAR_DADOS_ATELIE':
      if (relacionamento.ehTitular) {
        return { allowed: true, context };
      }
      return {
        allowed: false,
        reason: 'NOT_ATELIER_OWNER',
        errorCode: ATELIE_ERROR_CODES.ACESSO_ATELIE_NEGADO,
        message: 'Operação negada: apenas o artesão titular pode editar os dados do ateliê.',
      };

    case 'GERENCIAR_CATALOGO':
    case 'GERENCIAR_ETIQUETAS':
      if (relacionamento.ehTitular) {
        return { allowed: true, context };
      }
      if (relacionamento.ehCuradorVinculado) {
        if (relacionamento.statusAtelie === 'ATIVO') {
          return { allowed: true, context };
        }
        return {
          allowed: false,
          reason: 'ATELIER_SUSPENDED_FOR_CURATOR',
          errorCode: ATELIE_ERROR_CODES.ACESSO_ATELIE_NEGADO,
          message: 'Acesso negado: curadores não podem operar ateliês com status suspenso.',
        };
      }
      break;
  }

  return {
    allowed: false,
    reason: 'OPERATION_NOT_ALLOWED',
    errorCode: ATELIE_ERROR_CODES.ACESSO_ATELIE_NEGADO,
    message: 'Operação não autorizada para este ateliê.',
  };
}

/**
 * Fábrica do middleware de autorização contextual por ateliê.
 * Garante bloqueio RBAC antes da execução do controller e emite trilha de auditoria sem segredos.
 */
export function createAtelierRbacMiddleware(deps?: AtelierRbacDependencies) {
  const autorizacaoRepository =
    deps?.autorizacaoRepository ?? unconfiguredAtelieAutorizacaoRepository;
  const auditService = deps?.auditService ?? securityAuditService;

  return (operacao: OperacaoAtelie) =>
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        if (typeof req.auth?.userId !== 'string' || req.auth.userId.trim().length === 0) {
          next(new AppError('Autenticação obrigatória para acessar este recurso.', 401));
          return;
        }

        const parsedParams = atelieIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) {
          next(parsedParams.error);
          return;
        }

        const { atelieId } = parsedParams.data;

        let relacionamento: RelacionamentoUsuarioAtelie | null;
        try {
          relacionamento = await autorizacaoRepository.findRelacionamentoUsuarioAtelie(
            req.auth.userId,
            atelieId,
          );
        } catch (err) {
          if (err instanceof AppError) {
            next(err);
            return;
          }

          next(
            new AppError(
              'Não foi possível verificar as permissões do ateliê no momento.',
              503,
              ATELIE_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
            ),
          );
          return;
        }

        const decision = evaluateAtelierAccess(relacionamento, operacao);
        if (!decision.allowed) {
          const correlationId =
            req.correlationId ?? resolveCorrelationId(req.headers['x-request-id']);
          const rawPath = `${req.baseUrl ?? ''}${req.path ?? ''}` || req.originalUrl || '/';

          await auditService.recordAuthorizationDenial({
            correlationId,
            userId: req.auth.userId,
            atelieId,
            operation: operacao,
            reason: decision.reason,
            httpMethod: req.method,
            path: rawPath,
          });

          next(new AppError(decision.message, 403, decision.errorCode));
          return;
        }

        req.atelierAccess = decision.context;
        next();
      } catch (err) {
        if (err instanceof AppError) {
          next(err);
          return;
        }

        next(
          new AppError(
            'Não foi possível concluir a verificação de autorização do ateliê.',
            503,
            ATELIE_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
          ),
        );
      }
    };
}

/** Instância padrão conectada ao adaptador não configurado até a entrega da . */
export const requireAtelierPermission = createAtelierRbacMiddleware();
