/**
 * Tipos de status de pagamento alinhados ao enum `StatusPagamento` do Prisma/PostgreSQL,
 * isolados aqui para evitar acoplamento circular entre `integrations` e `repositories`.
 */
export type StatusPagamento =
  | 'CRIADO'
  | 'PENDENTE'
  | 'APROVADO'
  | 'RECUSADO'
  | 'EXPIRADO'
  | 'CANCELADO'
  | 'ESTORNADO'
  | 'ERRO_COMUNICACAO';

export type StatusPedido =
  | 'PENDENTE_PAGAMENTO'
  | 'APROVADO'
  | 'RECUSADO'
  | 'EXPIRADO'
  | 'CANCELADO'
  | 'RECONCILIACAO_ESTORNO';

export type MetodoPagamento = 'PIX' | 'CARTAO_CREDITO';
