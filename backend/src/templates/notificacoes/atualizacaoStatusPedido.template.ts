import { z } from 'zod';
import { escapeHtml, formatarDataHoraBr } from './formatters.js';
import { DESIGN_TOKENS_ORIGEM_EMAIL, renderizarLayoutEmailOrigem } from './layout.js';

export const STATUS_PEDIDO_SUPORTADOS = [
  'AGUARDANDO_POSTAGEM',
  'POSTADO',
  'EM_TRANSITO',
  'ENTREGUE',
  'CANCELADO_POR_ATRASO',
  'CANCELADO',
] as const;

export type StatusPedidoNotificacao = (typeof STATUS_PEDIDO_SUPORTADOS)[number];

export const atualizacaoStatusPedidoDadosSchema = z.object({
  pedidoId: z.string().uuid(),
  codigoPedido: z.string().trim().min(1),
  subpedidoId: z.string().uuid().optional(),
  destinatarioNome: z.string().trim().min(1),
  atelieNome: z.string().trim().min(1).optional(),
  novoStatus: z.enum(STATUS_PEDIDO_SUPORTADOS),
  ocorrenciaEm: z.union([z.string().min(1), z.date()]),
  codigoRastreio: z.string().trim().min(1).optional(),
  transportadora: z.string().trim().min(1).optional(),
  mensagemComplementar: z.string().trim().min(1).optional(),
  urlAcompanhamento: z.string().url().optional(),
  modoPreviewFicticio: z.boolean().optional(),
});

export type AtualizacaoStatusPedidoDados = z.infer<
  typeof atualizacaoStatusPedidoDadosSchema
>;

function descreverStatus(status: StatusPedidoNotificacao): {
  readonly rotulo: string;
  readonly resumo: string;
  readonly tom: 'terracota' | 'oliva' | 'aubergine';
} {
  switch (status) {
    case 'AGUARDANDO_POSTAGEM':
      return {
        rotulo: 'Aguardando postagem',
        resumo: 'Sua encomenda está sendo cuidadosamente preparada e embalada pelo ateliê.',
        tom: 'aubergine',
      };
    case 'POSTADO':
      return {
        rotulo: 'Objeto postado',
        resumo: 'O ateliê já realizou a postagem da sua peça e o código de rastreamento está disponível.',
        tom: 'oliva',
      };
    case 'EM_TRANSITO':
      return {
        rotulo: 'Em trânsito',
        resumo: 'Seu pacote está em deslocamento rumo ao endereço de entrega informado.',
        tom: 'oliva',
      };
    case 'ENTREGUE':
      return {
        rotulo: 'Pedido entregue',
        resumo: 'A entrega foi registrada. Verifique sua peça e conte com os prazos legais da plataforma em caso de intercorrência.',
        tom: 'oliva',
      };
    case 'CANCELADO_POR_ATRASO':
      return {
        rotulo: 'Cancelado por atraso de SLA',
        resumo: 'O subpedido foi cancelado por descumprimento do prazo máximo de 7 dias úteis para postagem, com estorno integral.',
        tom: 'terracota',
      };
    case 'CANCELADO':
      return {
        rotulo: 'Pedido cancelado',
        resumo: 'O status do seu pedido foi atualizado para cancelado.',
        tom: 'terracota',
      };
  }
}

export function renderizarAtualizacaoStatusPedido(entrada: AtualizacaoStatusPedidoDados) {
  const dados = atualizacaoStatusPedidoDadosSchema.parse(entrada);
  const tokens = DESIGN_TOKENS_ORIGEM_EMAIL;
  const infoStatus = descreverStatus(dados.novoStatus);
  const dataBr = formatarDataHoraBr(dados.ocorrenciaEm);

  const assunto = `${infoStatus.rotulo} · Pedido ${dados.codigoPedido}`;
  const preheader = `Atualização do pedido ${dados.codigoPedido} em ${dataBr}: ${infoStatus.rotulo}.`;

  const rastreioHtml = dados.codigoRastreio
    ? `<div style="margin-top:6px;"><strong style="color:${tokens.aubergine};">Código de rastreio:</strong> <code style="font-family:monospace;background-color:${tokens.surface};padding:2px 6px;border:1px solid ${tokens.bordaTerrosa};color:${tokens.aubergine};">${escapeHtml(dados.codigoRastreio)}</code></div>`
    : '';

  const corpoHtml = `
    <p style="margin:0 0 16px 0;color:${tokens.aubergine};">
      ${escapeHtml(infoStatus.resumo)}
    </p>
    ${
      dados.mensagemComplementar
        ? `<p style="margin:0 0 16px 0;color:${tokens.inkSoft};">${escapeHtml(dados.mensagemComplementar)}</p>`
        : ''
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${tokens.surfaceMuted};border:1px solid ${tokens.bordaTerrosa};margin:0 0 18px 0;border-radius:0;">
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:${tokens.inkSoft};">
          <div><strong style="color:${tokens.aubergine};">Pedido:</strong> ${escapeHtml(dados.codigoPedido)}</div>
          ${dados.subpedidoId ? `<div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Subpedido:</strong> ${escapeHtml(dados.subpedidoId)}</div>` : ''}
          ${dados.atelieNome ? `<div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Ateliê:</strong> ${escapeHtml(dados.atelieNome)}</div>` : ''}
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Novo status:</strong> ${escapeHtml(infoStatus.rotulo)}</div>
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Registrado em:</strong> ${escapeHtml(dataBr)}</div>
          ${dados.transportadora ? `<div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Transportadora:</strong> ${escapeHtml(dados.transportadora)}</div>` : ''}
          ${rastreioHtml}
        </td>
      </tr>
    </table>`;

  const html = renderizarLayoutEmailOrigem({
    titulo: `Atualização do pedido ${dados.codigoPedido}`,
    preheader,
    selo: { texto: infoStatus.rotulo, tom: infoStatus.tom },
    saudacao: `Olá, ${dados.destinatarioNome}.`,
    corpoHtml,
    cta: dados.urlAcompanhamento
      ? { texto: 'Ver detalhes do pedido', url: dados.urlAcompanhamento }
      : undefined,
    modoPreviewFicticio: dados.modoPreviewFicticio,
  });

  const texto = [
    dados.modoPreviewFicticio ? '[PRÉ-VISUALIZAÇÃO LOCAL COM DADOS FICTÍCIOS]\n' : '',
    `ORIGEM · ATUALIZAÇÃO DO PEDIDO ${dados.codigoPedido}`,
    `Olá, ${dados.destinatarioNome}.`,
    ``,
    `Status: ${infoStatus.rotulo} (${dataBr})`,
    infoStatus.resumo,
    dados.atelieNome ? `Ateliê: ${dados.atelieNome}` : '',
    dados.transportadora ? `Transportadora: ${dados.transportadora}` : '',
    dados.codigoRastreio ? `Código de rastreio: ${dados.codigoRastreio}` : '',
    dados.mensagemComplementar ?? '',
    dados.urlAcompanhamento ? `\nAcompanhe em: ${dados.urlAcompanhamento}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappTemplateNome = 'origem_atualizacao_status_pedido_v1';
  const whatsappParametros = [
    dados.destinatarioNome,
    dados.codigoPedido,
    infoStatus.rotulo,
    dados.codigoRastreio ?? 'N/A',
  ];
  const whatsappTexto = [
    `Origem: pedido ${dados.codigoPedido} atualizado para "${infoStatus.rotulo}" (${dataBr}).`,
    dados.codigoRastreio ? `Rastreio: ${dados.codigoRastreio}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return { assunto, html, texto, whatsappTemplateNome, whatsappParametros, whatsappTexto };
}
