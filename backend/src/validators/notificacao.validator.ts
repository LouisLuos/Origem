import { z } from 'zod';
import { STATUS_PEDIDO_SUPORTADOS } from '../templates/notificacoes/atualizacaoStatusPedido.template.js';

export const eventoPagamentoAprovadoItemSchema = z.object({
  subpedidoId: z.string().uuid().optional(),
  atelieId: z.string().uuid(),
  atelieNome: z.string().trim().min(1),
  poloCultural: z.string().trim().min(1).optional(),
  pecaId: z.string().uuid(),
  tituloPeca: z.string().trim().min(1),
  quantidade: z.number().int().positive(),
  precoUnitario: z.number().nonnegative(),
  subtotalItem: z.number().nonnegative(),
  isFragil: z.boolean().default(false),
});

export const eventoPagamentoAprovadoAtelieSchema = z.object({
  subpedidoId: z.string().uuid().optional(),
  atelieId: z.string().uuid(),
  atelieNome: z.string().trim().min(1),
  titularUsuarioId: z.string().uuid(),
  titularNome: z.string().trim().min(1),
  titularEmail: z.string().trim().email(),
  titularWhatsapp: z.string().trim().optional(),
  consentimentoWhatsappTitular: z.boolean().default(false),
  valorFreteAtelie: z.number().nonnegative(),
  dataLimitePostagem: z.union([z.string().min(1), z.date()]).optional(),
});

export const eventoPagamentoAprovadoSchema = z
  .object({
    eventoId: z.string().trim().min(1).max(128).optional(),
    pedidoId: z.string().uuid(),
    codigoPedido: z.string().trim().min(1).max(80),
    aprovadoEm: z.union([z.string().min(1), z.date()]),
    metodoPagamento: z.enum(['PIX', 'CARTAO_CREDITO', 'OUTRO']).default('PIX'),
    comprador: z.object({
      usuarioId: z.string().uuid(),
      nome: z.string().trim().min(1),
      email: z.string().trim().email(),
      whatsapp: z.string().trim().optional(),
      consentimentoWhatsapp: z.boolean().default(false),
    }),
    destino: z
      .object({
        cidade: z.string().trim().min(1),
        uf: z.string().trim().min(2).max(2),
      })
      .optional(),
    valorTotalPecas: z.number().nonnegative(),
    valorTotalFrete: z.number().nonnegative(),
    valorTotalPedido: z.number().nonnegative(),
    atelies: z.array(eventoPagamentoAprovadoAtelieSchema).min(1),
    itens: z.array(eventoPagamentoAprovadoItemSchema).min(1),
    correlationId: z.string().trim().max(128).optional(),
  })
  .superRefine((dados, ctx) => {
    const ateliesInformados = new Set(dados.atelies.map((a) => a.atelieId));
    for (const item of dados.itens) {
      if (!ateliesInformados.has(item.atelieId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['itens'],
          message: `Item "${item.tituloPeca}" referencia ateliê ${item.atelieId} ausente na lista de ateliês responsáveis.`,
        });
      }
    }
  });

export type EventoPagamentoAprovado = z.infer<typeof eventoPagamentoAprovadoSchema>;

export const eventoAtualizacaoStatusPedidoSchema = z.object({
  eventoId: z.string().trim().min(1).max(128).optional(),
  pedidoId: z.string().uuid(),
  codigoPedido: z.string().trim().min(1).max(80),
  subpedidoId: z.string().uuid().optional(),
  atelieId: z.string().uuid().optional(),
  atelieNome: z.string().trim().min(1).optional(),
  destinatario: z.object({
    usuarioId: z.string().uuid(),
    nome: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
    whatsapp: z.string().trim().optional(),
    consentimentoWhatsapp: z.boolean().default(false),
  }),
  novoStatus: z.enum(STATUS_PEDIDO_SUPORTADOS),
  ocorrenciaEm: z.union([z.string().min(1), z.date()]),
  codigoRastreio: z.string().trim().min(1).optional(),
  transportadora: z.string().trim().min(1).optional(),
  mensagemComplementar: z.string().trim().min(1).optional(),
  canais: z.array(z.enum(['EMAIL', 'WHATSAPP'])).min(1).default(['EMAIL']),
  correlationId: z.string().trim().max(128).optional(),
});

export type EventoAtualizacaoStatusPedido = z.infer<
  typeof eventoAtualizacaoStatusPedidoSchema
>;
