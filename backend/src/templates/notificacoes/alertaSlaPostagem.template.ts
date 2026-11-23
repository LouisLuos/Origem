import { z } from 'zod';
import { escapeHtml, formatarDataBr, formatarDataHoraBr } from './formatters.js';
import { DESIGN_TOKENS_ORIGEM_EMAIL, renderizarLayoutEmailOrigem } from './layout.js';

export const alertaSlaPostagemDadosSchema = z.object({
  pedidoId: z.string().uuid().optional(),
  codigoPedido: z.string().trim().min(1),
  subpedidoId: z.string().uuid(),
  atelieId: z.string().uuid(),
  atelieNome: z.string().trim().min(1),
  titularNome: z.string().trim().min(1),
  diasUteisDecorridos: z.number().int().min(5),
  prazoMaximoDiasUteis: z.number().int().min(7).default(7),
  pagamentoAprovadoEm: z.union([z.string().min(1), z.date()]),
  dataLimitePostagem: z.union([z.string().min(1), z.date()]),
  resumoItens: z.array(z.string().trim().min(1)).min(1),
  urlPainelAtelie: z.string().url().optional(),
  modoPreviewFicticio: z.boolean().optional(),
});

export type AlertaSlaPostagemDados = z.infer<typeof alertaSlaPostagemDadosSchema>;

export function renderizarAlertaSlaPostagem(entrada: AlertaSlaPostagemDados) {
  const dados = alertaSlaPostagemDadosSchema.parse(entrada);
  const tokens = DESIGN_TOKENS_ORIGEM_EMAIL;
  const aprovadoBr = formatarDataHoraBr(dados.pagamentoAprovadoEm);
  const limiteBr = formatarDataBr(dados.dataLimitePostagem);
  const diasRestantes = Math.max(0, dados.prazoMaximoDiasUteis - dados.diasUteisDecorridos);

  const assunto = `URGENTE: ${dados.diasUteisDecorridos}º dia útil sem postagem · Risco de cancelamento (${dados.codigoPedido})`;
  const preheader = `Seu subpedido do ateliê ${dados.atelieNome} atingiu o ${dados.diasUteisDecorridos}º dia útil sem código de rastreio. Poste até ${limiteBr} para evitar cancelamento com estorno integral.`;

  const itensHtml = dados.resumoItens
    .map((titulo) => `<li style="margin:0 0 6px 0;color:${tokens.aubergine};">${escapeHtml(titulo)}</li>`)
    .join('');

  const corpoHtml = `
    <div style="margin:0 0 18px 0;padding:14px 16px;background-color:${tokens.surfaceMuted};border:2px solid ${tokens.terracota};color:${tokens.aubergine};border-radius:0;">
      <strong style="display:block;font-size:15px;color:${tokens.terracota};margin-bottom:6px;">
        Atenção: risco de cancelamento automático com estorno integral (100%)
      </strong>
      <p style="margin:0;font-size:14px;line-height:1.5;">
        O subpedido ligado ao ateliê <strong>${escapeHtml(dados.atelieNome)}</strong> atingiu o <strong>${dados.diasUteisDecorridos}º dia útil</strong>
        desde a aprovação do pagamento sem registro de código de rastreamento.
      </p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${tokens.surfaceMuted};border:1px solid ${tokens.bordaTerrosa};margin:0 0 18px 0;border-radius:0;">
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:${tokens.inkSoft};">
          <div><strong style="color:${tokens.aubergine};">Pedido:</strong> ${escapeHtml(dados.codigoPedido)}</div>
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Subpedido:</strong> ${escapeHtml(dados.subpedidoId)}</div>
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Aprovado em:</strong> ${escapeHtml(aprovadoBr)}</div>
          <div style="margin-top:4px;"><strong style="color:${tokens.aubergine};">Data limite de postagem (${dados.prazoMaximoDiasUteis} dias úteis):</strong> <strong style="color:${tokens.terracota};">${escapeHtml(limiteBr)}</strong> (${diasRestantes} dia(s) útil(eis) restante(s))</div>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:${tokens.aubergine};">Peças aguardando envio:</p>
    <ul style="margin:0 0 16px 18px;padding:0;font-size:14px;">
      ${itensHtml}
    </ul>
    <p style="margin:0;font-size:14px;color:${tokens.inkSoft};">
      Caso o prazo máximo de <strong>${dados.prazoMaximoDiasUteis} dias úteis</strong> seja ultrapassado sem código de rastreio válido,
      o comprador poderá cancelar o subpedido por atraso com estorno de 100% (peça + frete) sem repasse ao ateliê.
    </p>`;

  const html = renderizarLayoutEmailOrigem({
    titulo: `Alerta urgente de postagem (${dados.diasUteisDecorridos}º dia útil)`,
    preheader,
    selo: { texto: 'Urgente · SLA de Postagem', tom: 'terracota' },
    saudacao: `Olá, ${dados.titularNome}.`,
    corpoHtml,
    cta: dados.urlPainelAtelie
      ? { texto: 'Registrar código de rastreio agora', url: dados.urlPainelAtelie }
      : undefined,
    modoPreviewFicticio: dados.modoPreviewFicticio,
  });

  const texto = [
    dados.modoPreviewFicticio ? '[PRÉ-VISUALIZAÇÃO LOCAL COM DADOS FICTÍCIOS]\n' : '',
    `ORIGEM · ALERTA URGENTE DE POSTAGEM (${dados.diasUteisDecorridos}º DIA ÚTIL)`,
    `Olá, ${dados.titularNome}.`,
    ``,
    `RISCO DE CANCELAMENTO COM ESTORNO DE 100%: o subpedido ${dados.subpedidoId} (pedido ${dados.codigoPedido}) do ateliê ${dados.atelieNome} atingiu o ${dados.diasUteisDecorridos}º dia útil sem registro de postagem.`,
    `Data limite de postagem (${dados.prazoMaximoDiasUteis} dias úteis): ${limiteBr}.`,
    `Peças: ${dados.resumoItens.join(', ')}.`,
    dados.urlPainelAtelie ? `\nRegistre o código de rastreio em: ${dados.urlPainelAtelie}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappTemplateNome = 'origem_alerta_sla_postagem_dia5_v1';
  const whatsappParametros = [
    dados.titularNome,
    dados.atelieNome,
    dados.codigoPedido,
    String(dados.diasUteisDecorridos),
    limiteBr,
  ];
  const whatsappTexto = [
    `URGENTE Origem (${dados.atelieNome}): pedido ${dados.codigoPedido} no ${dados.diasUteisDecorridos}o dia util sem postagem.`,
    `Prazo limite: ${limiteBr} (${dados.prazoMaximoDiasUteis} dias uteis).`,
    `Risco de cancelamento automatico com estorno integral se nao postado no prazo.`,
  ].join(' ');

  return { assunto, html, texto, whatsappTemplateNome, whatsappParametros, whatsappTexto };
}
