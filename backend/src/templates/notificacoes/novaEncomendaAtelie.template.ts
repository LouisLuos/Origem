import { z } from 'zod';
import {
  escapeHtml,
  formatarDataBr,
  formatarDataHoraBr,
  formatarMoedaBrl,
} from './formatters.js';
import {
  DESIGN_TOKENS_ORIGEM_EMAIL,
  renderizarLayoutEmailOrigem,
} from './layout.js';

export const itemEncomendaAtelieSchema = z.object({
  tituloPeca: z.string().trim().min(1),
  quantidade: z.number().int().positive(),
  valorUnitario: z.number().nonnegative(),
  subtotalItem: z.number().nonnegative(),
  isFragil: z.boolean().default(false),
});

export const novaEncomendaAtelieDadosSchema = z.object({
  pedidoId: z.string().uuid(),
  codigoPedido: z.string().trim().min(1),
  subpedidoId: z.string().uuid().optional(),
  atelieId: z.string().uuid(),
  atelieNome: z.string().trim().min(1),
  titularNome: z.string().trim().min(1),
  cidadeDestino: z.string().trim().min(1).optional(),
  ufDestino: z.string().trim().min(2).max(2).optional(),
  aprovadoEm: z.union([z.string().min(1), z.date()]),
  dataLimitePostagem: z.union([z.string().min(1), z.date()]).optional(),
  valorItensAtelie: z.number().nonnegative(),
  valorFreteAtelie: z.number().nonnegative(),
  itens: z.array(itemEncomendaAtelieSchema).min(1),
  urlPainelAtelie: z.string().url().optional(),
  modoPreviewFicticio: z.boolean().optional(),
});

export type NovaEncomendaAtelieDados = z.infer<typeof novaEncomendaAtelieDadosSchema>;

export function renderizarNovaEncomendaAtelie(entrada: NovaEncomendaAtelieDados) {
  const dados = novaEncomendaAtelieDadosSchema.parse(entrada);
  const tokens = DESIGN_TOKENS_ORIGEM_EMAIL;
  const aprovadoBr = formatarDataHoraBr(dados.aprovadoEm);
  const limitePostagemBr = dados.dataLimitePostagem
    ? formatarDataBr(dados.dataLimitePostagem)
    : '7 dias úteis após a aprovação';
  const totalItensBrl = formatarMoedaBrl(dados.valorItensAtelie);
  const totalFreteBrl = formatarMoedaBrl(dados.valorFreteAtelie);
  const possuiFragil = dados.itens.some((item) => item.isFragil);

  const assunto = `Nova encomenda aprovada · ${dados.atelieNome} (${dados.codigoPedido})`;
  const preheader = `Pedido ${dados.codigoPedido} aprovado em ${aprovadoBr}. Prepare as peças e poste dentro do prazo de SLA.`;

  const linhasHtml = dados.itens
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid ${tokens.bordaTerrosa};color:${tokens.aubergine};font-size:14px;">
          <strong>${escapeHtml(item.tituloPeca)}</strong>
          ${item.isFragil ? `<span style="display:inline-block;margin-left:6px;padding:2px 6px;background-color:${tokens.terracota};color:#FFFDF9;font-size:11px;font-weight:700;">Peça frágil</span>` : ''}
        </td>
        <td align="center" style="padding:10px 8px;border-bottom:1px solid ${tokens.bordaTerrosa};font-size:14px;">${item.quantidade}x</td>
        <td align="right" style="padding:10px 12px;border-bottom:1px solid ${tokens.bordaTerrosa};font-size:14px;font-weight:600;">${escapeHtml(formatarMoedaBrl(item.subtotalItem))}</td>
      </tr>`,
    )
    .join('');

  const alertaFragilHtml = possuiFragil
    ? `<div style="margin:0 0 18px 0;padding:12px 16px;background-color:${tokens.surfaceMuted};border-left:4px solid ${tokens.terracota};font-size:13px;color:${tokens.aubergine};">
         <strong>Atenção para embalagem de peça frágil:</strong> consulte o guia de proteção e acondicionamento seguro no painel antes de emitir a etiqueta de envio.
       </div>`
    : '';

  const destinoResumo =
    dados.cidadeDestino && dados.ufDestino
      ? `${dados.cidadeDestino}/${dados.ufDestino}`
      : 'Confirmar etiqueta no painel do ateliê';

  const corpoHtml = `
    <p style="margin:0 0 16px 0;color:${tokens.aubergine};">
      O ateliê <strong>${escapeHtml(dados.atelieNome)}</strong> recebeu uma nova encomenda com pagamento confirmado em <strong>${escapeHtml(aprovadoBr)}</strong>.
    </p>
    ${alertaFragilHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${tokens.surfaceMuted};border:1px solid ${tokens.bordaTerrosa};margin:0 0 18px 0;border-radius:0;">
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:${tokens.inkSoft};">
          <div><strong style="color:${tokens.aubergine};">Pedido:</strong> ${escapeHtml(dados.codigoPedido)}</div>
          ${dados.subpedidoId ? `<div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Subpedido:</strong> ${escapeHtml(dados.subpedidoId)}</div>` : ''}
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Destino:</strong> ${escapeHtml(destinoResumo)}</div>
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Prazo limite de postagem (7 dias úteis):</strong> ${escapeHtml(limitePostagemBr)}</div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${tokens.bordaTerrosa};border-collapse:collapse;margin:0 0 16px 0;border-radius:0;">
      <thead>
        <tr style="background-color:${tokens.surfaceMuted};">
          <th align="left" style="padding:10px 12px;border-bottom:1px solid ${tokens.bordaTerrosa};font-size:12px;color:${tokens.aubergine};">Peça</th>
          <th align="center" style="padding:10px 8px;border-bottom:1px solid ${tokens.bordaTerrosa};font-size:12px;color:${tokens.aubergine};">Qtd.</th>
          <th align="right" style="padding:10px 12px;border-bottom:1px solid ${tokens.bordaTerrosa};font-size:12px;color:${tokens.aubergine};">Subtotal</th>
        </tr>
      </thead>
      <tbody>${linhasHtml}</tbody>
    </table>
    <p style="margin:0;font-size:14px;color:${tokens.inkSoft};">
      Total das peças do ateliê: <strong style="color:${tokens.aubergine};">${escapeHtml(totalItensBrl)}</strong> · Frete alocado ao subpedido: <strong style="color:${tokens.aubergine};">${escapeHtml(totalFreteBrl)}</strong>
    </p>`;

  const html = renderizarLayoutEmailOrigem({
    titulo: `Nova encomenda para ${dados.atelieNome}`,
    preheader,
    selo: { texto: 'Nova encomenda', tom: 'terracota' },
    saudacao: `Olá, ${dados.titularNome}.`,
    corpoHtml,
    cta: dados.urlPainelAtelie
      ? { texto: 'Abrir remessa no painel do ateliê', url: dados.urlPainelAtelie }
      : undefined,
    modoPreviewFicticio: dados.modoPreviewFicticio,
  });

  const texto = [
    dados.modoPreviewFicticio ? '[PRÉ-VISUALIZAÇÃO LOCAL COM DADOS FICTÍCIOS]\n' : '',
    `ORIGEM · NOVA ENCOMENDA (${dados.atelieNome})`,
    `Olá, ${dados.titularNome}.`,
    ``,
    `Pedido: ${dados.codigoPedido} (aprovado em ${aprovadoBr})`,
    dados.subpedidoId ? `Subpedido: ${dados.subpedidoId}` : '',
    `Prazo limite de postagem: ${limitePostagemBr}`,
    ``,
    `PEÇAS DO ATELIÊ:`,
    ...dados.itens.map(
      (item) =>
        `- ${item.tituloPeca}${item.isFragil ? ' [FRÁGIL]' : ''}: ${item.quantidade}x — ${formatarMoedaBrl(item.subtotalItem)}`,
    ),
    ``,
    `Subtotal peças: ${totalItensBrl} | Frete alocado: ${totalFreteBrl}`,
    dados.urlPainelAtelie ? `\nAcesse o painel: ${dados.urlPainelAtelie}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappTemplateNome = 'origem_nova_encomenda_atelie_v1';
  const whatsappParametros = [
    dados.titularNome,
    dados.atelieNome,
    dados.codigoPedido,
    totalItensBrl,
    limitePostagemBr,
  ];
  const whatsappTexto = [
    `Origem · Nova encomenda para ${dados.atelieNome}!`,
    `Pedido ${dados.codigoPedido} aprovado (${totalItensBrl} em peças).`,
    `Prazo limite de postagem: ${limitePostagemBr}.`,
  ].join(' ');

  return { assunto, html, texto, whatsappTemplateNome, whatsappParametros, whatsappTexto };
}
