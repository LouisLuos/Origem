import { escapeHtml, sanitizarUrlHttp } from './formatters.js';

export const DESIGN_TOKENS_ORIGEM_EMAIL = {
  creme: '#EFE1CB',
  surface: '#FFFDF9',
  surfaceMuted: '#F7F1E5',
  aubergine: '#3F1B18',
  inkSoft: '#6B453F',
  terracota: '#B34E24',
  oliva: '#5D6737',
  bordaTerrosa: '#D8C7B2',
  fonte: "'DM Sans', 'Segoe UI', Arial, sans-serif",
} as const;

export interface LayoutEmailOrigemOptions {
  readonly titulo: string;
  readonly preheader: string;
  readonly selo?: {
    readonly texto: string;
    readonly tom: 'terracota' | 'oliva' | 'aubergine';
  };
  readonly saudacao: string;
  readonly corpoHtml: string;
  readonly cta?: {
    readonly texto: string;
    readonly url: string;
  };
  readonly rodapeNota?: string;
  readonly modoPreviewFicticio?: boolean;
}

/**
 * Shell HTML tabular responsivo alinhado ao `DESIGN_SYSTEM.md` do Origem:
 * paleta terrosa de Pernambuco, cantos retos (`border-radius: 0`), contraste AA e tipografia `DM Sans`.
 */
export function renderizarLayoutEmailOrigem(opcoes: LayoutEmailOrigemOptions): string {
  const tokens = DESIGN_TOKENS_ORIGEM_EMAIL;
  const tituloSeguro = escapeHtml(opcoes.titulo);
  const preheaderSeguro = escapeHtml(opcoes.preheader);
  const saudacaoSegura = escapeHtml(opcoes.saudacao);
  const rodapeNotaSegura = escapeHtml(
    opcoes.rodapeNota ??
      'Esta é uma notificação automática transacional do Origem Marketplace. Não responda a este e-mail.',
  );

  const ctaUrlSegura = sanitizarUrlHttp(opcoes.cta?.url);
  const ctaHtml =
    opcoes.cta && ctaUrlSegura
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
           <tr>
             <td bgcolor="${tokens.terracota}" style="background-color:${tokens.terracota};border-radius:0;">
               <a href="${escapeHtml(ctaUrlSegura)}" style="display:inline-block;padding:13px 22px;font-family:${tokens.fonte};font-size:15px;font-weight:600;line-height:1.2;color:#FFFDF9;text-decoration:none;border-radius:0;">
                 ${escapeHtml(opcoes.cta.texto)}
               </a>
             </td>
           </tr>
         </table>`
      : '';

  const seloCor =
    opcoes.selo?.tom === 'oliva'
      ? tokens.oliva
      : opcoes.selo?.tom === 'aubergine'
        ? tokens.aubergine
        : tokens.terracota;

  const seloHtml = opcoes.selo
    ? `<div style="display:inline-block;margin:0 0 12px 0;padding:4px 10px;background-color:${seloCor};color:#FFFDF9;font-family:${tokens.fonte};font-size:12px;font-weight:700;line-height:1.3;border-radius:0;">
         ${escapeHtml(opcoes.selo.texto)}
       </div>`
    : '';

  const faixaPreviewHtml = opcoes.modoPreviewFicticio
    ? `<tr>
         <td style="background-color:${tokens.terracota};color:#FFFDF9;padding:8px 24px;font-family:${tokens.fonte};font-size:12px;font-weight:600;border-radius:0;">
           PRÉ-VISUALIZAÇÃO LOCAL COM DADOS FICTÍCIOS — MODELO VISUAL HU-17
         </td>
       </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${tituloSeguro}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .origem-container { width: 100% !important; }
      .origem-pad { padding: 20px 16px !important; }
      .origem-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${tokens.creme};color:${tokens.aubergine};font-family:${tokens.fonte};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
    ${preheaderSeguro}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${tokens.creme};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="origem-container" style="width:100%;max-width:600px;background-color:${tokens.surface};border:1px solid ${tokens.bordaTerrosa};border-radius:0;">
          ${faixaPreviewHtml}
          <tr>
            <td style="background-color:${tokens.aubergine};padding:22px 28px;border-bottom:4px solid ${tokens.terracota};border-radius:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${tokens.fonte};font-size:20px;font-weight:700;color:#FFFDF9;letter-spacing:-0.01em;">
                    Origem
                  </td>
                  <td align="right" style="font-family:${tokens.fonte};font-size:12px;font-weight:500;color:${tokens.creme};">
                    Artesanato &amp; Economia Criativa de Pernambuco
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="origem-pad" style="padding:28px;font-family:${tokens.fonte};font-size:15px;line-height:1.55;color:${tokens.aubergine};">
              ${seloHtml}
              <h1 style="margin:0 0 14px 0;font-family:${tokens.fonte};font-size:22px;font-weight:700;line-height:1.25;color:${tokens.aubergine};">
                ${tituloSeguro}
              </h1>
              <p style="margin:0 0 16px 0;font-size:15px;color:${tokens.aubergine};">
                ${saudacaoSegura}
              </p>
              ${opcoes.corpoHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${tokens.surfaceMuted};padding:18px 28px;border-top:1px solid ${tokens.bordaTerrosa};font-family:${tokens.fonte};font-size:12px;line-height:1.5;color:${tokens.inkSoft};border-radius:0;">
              <p style="margin:0 0 6px 0;font-weight:600;color:${tokens.aubergine};">
                Origem Marketplace · Economia Criativa de Pernambuco
              </p>
              <p style="margin:0;">
                ${rodapeNotaSegura}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
