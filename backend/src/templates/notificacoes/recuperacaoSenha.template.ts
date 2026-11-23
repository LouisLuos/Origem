import { z } from 'zod';
import { DESIGN_TOKENS_ORIGEM_EMAIL, renderizarLayoutEmailOrigem } from './layout.js';

export const recuperacaoSenhaDadosSchema = z.object({
  nome: z.string().trim().min(1),
  urlRedefinicao: z.string().url(),
  validadeMinutos: z.number().int().positive(),
  modoPreviewFicticio: z.boolean().optional(),
});

export type RecuperacaoSenhaDados = z.infer<typeof recuperacaoSenhaDadosSchema>;

export function renderizarRecuperacaoSenha(entrada: RecuperacaoSenhaDados) {
  const dados = recuperacaoSenhaDadosSchema.parse(entrada);
  const tokens = DESIGN_TOKENS_ORIGEM_EMAIL;

  const assunto = 'Redefinição de senha · Origem';
  const preheader = `Use o link para criar uma nova senha. Ele vale por ${dados.validadeMinutos} minutos e só pode ser usado uma vez.`;

  const corpoHtml = `
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.5;color:${tokens.aubergine};">
      Recebemos um pedido para redefinir a senha da sua conta no Origem.
    </p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.5;color:${tokens.inkSoft};">
      O link abaixo vale por <strong>${dados.validadeMinutos} minutos</strong> e pode ser usado uma única vez.
      Ao salvar a nova senha, todas as sessões abertas da sua conta serão encerradas.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:${tokens.inkSoft};">
      Se você não pediu a redefinição, ignore este e-mail. Sua senha atual continua valendo.
    </p>`;

  const html = renderizarLayoutEmailOrigem({
    titulo: 'Redefinição de senha',
    preheader,
    selo: { texto: 'Segurança da conta', tom: 'aubergine' },
    saudacao: `Olá, ${dados.nome}.`,
    corpoHtml,
    cta: { texto: 'Criar nova senha', url: dados.urlRedefinicao },
    modoPreviewFicticio: dados.modoPreviewFicticio,
  });

  const texto = [
    dados.modoPreviewFicticio ? '[PRÉ-VISUALIZAÇÃO LOCAL COM DADOS FICTÍCIOS]\n' : '',
    'ORIGEM · REDEFINIÇÃO DE SENHA',
    '',
    `Olá, ${dados.nome}.`,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no Origem.',
    `Acesse o link abaixo para criar uma nova senha. Ele vale por ${dados.validadeMinutos} minutos e pode ser usado uma única vez:`,
    dados.urlRedefinicao,
    '',
    'Ao salvar a nova senha, todas as sessões abertas da sua conta serão encerradas.',
    'Se você não pediu a redefinição, ignore este e-mail. Sua senha atual continua valendo.',
  ]
    .filter((linha, indice) => indice !== 0 || linha.length > 0)
    .join('\n');

  return { assunto, html, texto };
}
