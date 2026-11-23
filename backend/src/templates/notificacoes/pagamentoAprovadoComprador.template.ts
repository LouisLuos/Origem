import { z } from 'zod';
import {
  escapeHtml,
  formatarDataHoraBr,
  formatarMoedaBrl,
} from './formatters.js';
import {
  DESIGN_TOKENS_ORIGEM_EMAIL,
  renderizarLayoutEmailOrigem,
} from './layout.js';

export const itemReciboPagamentoSchema = z.object({
  tituloPeca: z.string().trim().min(1),
  atelieNome: z.string().trim().min(1),
  poloCultural: z.string().trim().min(1).optional(),
  quantidade: z.number().int().positive(),
  precoUnitario: z.number().nonnegative(),
  subtotalItem: z.number().nonnegative(),
});

export const pagamentoAprovadoCompradorDadosSchema = z.object({
  pedidoId: z.string().uuid(),
  codigoPedido: z.string().trim().min(1),
  compradorNome: z.string().trim().min(1),
  metodoPagamento: z.enum(['PIX', 'CARTAO_CREDITO', 'OUTRO']).default('PIX'),
  aprovadoEm: z.union([z.string().min(1), z.date()]),
  valorTotalPecas: z.number().nonnegative(),
  valorTotalFrete: z.number().nonnegative(),
  valorTotalPedido: z.number().nonnegative(),
  itens: z.array(itemReciboPagamentoSchema).min(1),
  urlAcompanhamento: z.string().url().optional(),
  modoPreviewFicticio: z.boolean().optional(),
});

export type PagamentoAprovadoCompradorDados = z.infer<
  typeof pagamentoAprovadoCompradorDadosSchema
>;

function rotuloMetodoPagamento(metodo: PagamentoAprovadoCompradorDados['metodoPagamento']): string {
  if (metodo === 'PIX') return 'Pix';
  if (metodo === 'CARTAO_CREDITO') return 'Cartão de crédito';
  return 'Pagamento eletrônico';
}

export function renderizarPagamentoAprovadoComprador(
  entrada: PagamentoAprovadoCompradorDados,
) {
  const dados = pagamentoAprovadoCompradorDadosSchema.parse(entrada);
  const tokens = DESIGN_TOKENS_ORIGEM_EMAIL;
  const dataHoraBr = formatarDataHoraBr(dados.aprovadoEm);
  const totalPecasBrl = formatarMoedaBrl(dados.valorTotalPecas);
  const totalFreteBrl = formatarMoedaBrl(dados.valorTotalFrete);
  const totalPedidoBrl = formatarMoedaBrl(dados.valorTotalPedido);
  const metodo = rotuloMetodoPagamento(dados.metodoPagamento);

  const assunto = `Pagamento aprovado · Pedido ${dados.codigoPedido} (${totalPedidoBrl})`;
  const preheader = `Seu pagamento de ${totalPedidoBrl} foi confirmado. Os ateliês já foram notificados para preparo.`;

  const linhasHtml = dados.itens
    .map((item) => {
      const origemTexto = item.poloCultural
        ? `${escapeHtml(item.atelieNome)} · ${escapeHtml(item.poloCultural)}`
        : escapeHtml(item.atelieNome);
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid ${tokens.bordaTerrosa};vertical-align:top;">
            <strong style="display:block;color:${tokens.aubergine};font-size:14px;">${escapeHtml(item.tituloPeca)}</strong>
            <span style="display:block;color:${tokens.inkSoft};font-size:12px;margin-top:2px;">${origemTexto}</span>
          </td>
          <td align="center" style="padding:10px 8px;border-bottom:1px solid ${tokens.bordaTerrosa};color:${tokens.aubergine};font-size:14px;white-space:nowrap;">
            ${item.quantidade}x
          </td>
          <td align="right" style="padding:10px 12px;border-bottom:1px solid ${tokens.bordaTerrosa};color:${tokens.aubergine};font-size:14px;font-weight:600;white-space:nowrap;">
            ${escapeHtml(formatarMoedaBrl(item.subtotalItem))}
          </td>
        </tr>`;
    })
    .join('');

  const corpoHtml = `
    <p style="margin:0 0 16px 0;color:${tokens.aubergine};">
      Recebemos a confirmação do seu pagamento via <strong>${escapeHtml(metodo)}</strong> em <strong>${escapeHtml(dataHoraBr)}</strong>.
      Cada ateliê responsável já recebeu a solicitação para embalagem segura e postagem das suas peças.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${tokens.surfaceMuted};border:1px solid ${tokens.bordaTerrosa};margin:0 0 20px 0;border-radius:0;">
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:${tokens.inkSoft};">
          <div><strong style="color:${tokens.aubergine};">Pedido:</strong> ${escapeHtml(dados.codigoPedido)}</div>
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Aprovado em:</strong> ${escapeHtml(dataHoraBr)} (Horário de Pernambuco)</div>
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Forma de pagamento:</strong> ${escapeHtml(metodo)}</div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${tokens.bordaTerrosa};border-collapse:collapse;margin:0 0 18px 0;border-radius:0;">
      <thead>
        <tr style="background-color:${tokens.surfaceMuted};">
          <th align="left" style="padding:10px 12px;border-bottom:1px solid ${tokens.bordaTerrosa};font-size:12px;font-weight:700;color:${tokens.aubergine};">Peça e ateliê</th>
          <th align="center" style="padding:10px 8px;border-bottom:1px solid ${tokens.bordaTerrosa};font-size:12px;font-weight:700;color:${tokens.aubergine};">Qtd.</th>
          <th align="right" style="padding:10px 12px;border-bottom:1px solid ${tokens.bordaTerrosa};font-size:12px;font-weight:700;color:${tokens.aubergine};">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${linhasHtml}
      </tbody>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${tokens.surfaceMuted};border:1px solid ${tokens.bordaTerrosa};border-radius:0;">
      <tr>
        <td style="padding:12px 16px;font-size:14px;color:${tokens.inkSoft};">Peças</td>
        <td align="right" style="padding:12px 16px;font-size:14px;color:${tokens.aubergine};font-weight:600;">${escapeHtml(totalPecasBrl)}</td>
      </tr>
      <tr>
        <td style="padding:0 16px 12px 16px;font-size:14px;color:${tokens.inkSoft};">Frete consolidado</td>
        <td align="right" style="padding:0 16px 12px 16px;font-size:14px;color:${tokens.aubergine};font-weight:600;">${escapeHtml(totalFreteBrl)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-top:1px solid ${tokens.bordaTerrosa};font-size:16px;font-weight:700;color:${tokens.aubergine};">Total pago</td>
        <td align="right" style="padding:12px 16px;border-top:1px solid ${tokens.bordaTerrosa};font-size:16px;font-weight:700;color:${tokens.terracota};">${escapeHtml(totalPedidoBrl)}</td>
      </tr>
    </table>`;

  const html = renderizarLayoutEmailOrigem({
    titulo: `Recibo do pedido ${dados.codigoPedido}`,
    preheader,
    selo: { texto: 'Pagamento aprovado', tom: 'oliva' },
    saudacao: `Olá, ${dados.compradorNome}.`,
    corpoHtml,
    cta: dados.urlAcompanhamento
      ? { texto: 'Acompanhar pedido no Origem', url: dados.urlAcompanhamento }
      : undefined,
    modoPreviewFicticio: dados.modoPreviewFicticio,
  });

  const linhasTexto = dados.itens
    .map(
      (item) =>
        `- ${item.tituloPeca} (${item.atelieNome}${item.poloCultural ? ` · ${item.poloCultural}` : ''}): ${item.quantidade}x — ${formatarMoedaBrl(item.subtotalItem)}`,
    )
    .join('\n');

  const texto = [
    dados.modoPreviewFicticio ? '[PRÉ-VISUALIZAÇÃO LOCAL COM DADOS FICTÍCIOS]\n' : '',
    `ORIGEM · PAGAMENTO APROVADO`,
    `Olá, ${dados.compradorNome}.`,
    ``,
    `Seu pagamento do pedido ${dados.codigoPedido} foi aprovado em ${dataHoraBr} via ${metodo}.`,
    ``,
    `ITENS DO PEDIDO:`,
    linhasTexto,
    ``,
    `Peças: ${totalPecasBrl}`,
    `Frete consolidado: ${totalFreteBrl}`,
    `Total pago: ${totalPedidoBrl}`,
    dados.urlAcompanhamento ? `\nAcompanhe em: ${dados.urlAcompanhamento}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { assunto, html, texto };
}
