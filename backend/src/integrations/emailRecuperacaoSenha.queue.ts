import { pingRedis } from '../cache/redis.client.js';
import { createNotificationProducer } from '../queues/notification.queue.js';
import type { EnvioEmailRecuperacao } from '../repositories/contracts/hu02.contracts.js';
import { prismaNotificacaoLogRepository } from '../repositories/prismaNotificacaoLog.repository.js';

/** Enfileira o e-mail de recuperação na fila de notificações da HU-17 (worker separado). */
export const filaEmailRecuperacaoSenha: EnvioEmailRecuperacao = {
  async enfileirar({ recuperacaoId, usuario, urlRedefinicao, validadeMinutos }) {
    if (!(await pingRedis())) {
      throw new Error('Fila de notificações indisponível: Redis não respondeu.');
    }

    const producer = createNotificationProducer({ logRepository: prismaNotificacaoLogRepository });
    try {
      await producer.enfileirar({
        eventoOrigem: 'RECUPERACAO_SENHA_SOLICITADA',
        canal: 'EMAIL',
        destinatarioReal: usuario.email,
        usuarioId: usuario.id,
        idempotencyKey: `recuperacao_senha_${recuperacaoId}`,
        payloadTemplate: {
          template: 'RECUPERACAO_SENHA',
          dados: { nome: usuario.nome, urlRedefinicao, validadeMinutos },
        },
      });
    } finally {
      await producer.fechar();
    }
  },
};
