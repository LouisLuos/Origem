import fs from 'node:fs/promises';
import path from 'node:path';
import {
  renderizarTemplateNotificacao,
  type PayloadTemplateNotificacao,
} from '../src/templates/notificacoes/index.js';

const DIRETORIO_PREVIEWS = path.resolve(process.cwd(), 'previews', 'notificacoes');

const EXEMPLOS_FICTICIOS: ReadonlyArray<{
  readonly arquivoBase: string;
  readonly payload: PayloadTemplateNotificacao;
}> = [
  {
    arquivoBase: '01-pagamento-aprovado-comprador',
    payload: {
      template: 'PAGAMENTO_APROVADO_COMPRADOR',
      dados: {
        pedidoId: '11111111-1111-4111-8111-111111111111',
        codigoPedido: 'ORIGEM-2026-FICTICIO-001',
        compradorNome: 'Comprador Exemplo (Dados Fictícios)',
        metodoPagamento: 'PIX',
        aprovadoEm: '2026-11-22T17:45:00.000Z',
        valorTotalPecas: 520,
        valorTotalFrete: 58.9,
        valorTotalPedido: 578.9,
        urlAcompanhamento: 'http://localhost:5173/pedido/ORIGEM-2026-FICTICIO-001',
        modoPreviewFicticio: true,
        itens: [
          {
            tituloPeca: 'Moradia Sertaneja em Barro Cozido (Fictício)',
            atelieNome: 'Ateliê Alto do Moura (Fictício)',
            poloCultural: 'Caruaru',
            quantidade: 1,
            precoUnitario: 340,
            subtotalItem: 340,
          },
          {
            tituloPeca: 'Moringa de Xilogravura e Terracota (Fictício)',
            atelieNome: 'Casa da Xilo de Olinda (Fictício)',
            poloCultural: 'Olinda',
            quantidade: 2,
            precoUnitario: 90,
            subtotalItem: 180,
          },
        ],
      },
    },
  },
  {
    arquivoBase: '02-nova-encomenda-atelie',
    payload: {
      template: 'NOVA_ENCOMENDA_ATELIE',
      dados: {
        pedidoId: '11111111-1111-4111-8111-111111111111',
        codigoPedido: 'ORIGEM-2026-FICTICIO-001',
        subpedidoId: '22222222-2222-4222-8222-222222222222',
        atelieId: '33333333-3333-4333-8333-333333333333',
        atelieNome: 'Ateliê Alto do Moura (Fictício)',
        titularNome: 'Mestra Artesã Exemplo (Dados Fictícios)',
        cidadeDestino: 'Recife',
        ufDestino: 'PE',
        aprovadoEm: '2026-11-22T17:45:00.000Z',
        dataLimitePostagem: '2026-12-01T23:59:59.000Z',
        valorItensAtelie: 340,
        valorFreteAtelie: 29.45,
        urlPainelAtelie: 'http://localhost:5173/painel',
        modoPreviewFicticio: true,
        itens: [
          {
            tituloPeca: 'Moradia Sertaneja em Barro Cozido (Fictício)',
            quantidade: 1,
            valorUnitario: 340,
            subtotalItem: 340,
            isFragil: true,
          },
        ],
      },
    },
  },
  {
    arquivoBase: '03-alerta-sla-postagem-dia5',
    payload: {
      template: 'ALERTA_SLA_POSTAGEM_DIA5',
      dados: {
        pedidoId: '11111111-1111-4111-8111-111111111111',
        codigoPedido: 'ORIGEM-2026-FICTICIO-002',
        subpedidoId: '44444444-4444-4444-8444-444444444444',
        atelieId: '33333333-3333-4333-8333-333333333333',
        atelieNome: 'Ateliê Alto do Moura (Fictício)',
        titularNome: 'Mestra Artesã Exemplo (Dados Fictícios)',
        diasUteisDecorridos: 5,
        prazoMaximoDiasUteis: 7,
        pagamentoAprovadoEm: '2026-11-16T15:00:00.000Z',
        dataLimitePostagem: '2026-11-25T23:59:59.000Z',
        resumoItens: ['Escultura Casal de Retirantes (Fictício)'],
        urlPainelAtelie: 'http://localhost:5173/painel',
        modoPreviewFicticio: true,
      },
    },
  },
  {
    arquivoBase: '04-atualizacao-status-pedido',
    payload: {
      template: 'ATUALIZACAO_STATUS_PEDIDO',
      dados: {
        pedidoId: '11111111-1111-4111-8111-111111111111',
        codigoPedido: 'ORIGEM-2026-FICTICIO-001',
        subpedidoId: '22222222-2222-4222-8222-222222222222',
        destinatarioNome: 'Comprador Exemplo (Dados Fictícios)',
        atelieNome: 'Ateliê Alto do Moura (Fictício)',
        novoStatus: 'POSTADO',
        ocorrenciaEm: '2026-11-24T14:20:00.000Z',
        transportadora: 'Correios SEDEX',
        codigoRastreio: 'BR123456789PE',
        urlAcompanhamento: 'http://localhost:5173/pedido/ORIGEM-2026-FICTICIO-001',
        modoPreviewFicticio: true,
      },
    },
  },
];

async function main(): Promise<void> {
  await fs.mkdir(DIRETORIO_PREVIEWS, { recursive: true });

  for (const item of EXEMPLOS_FICTICIOS) {
    const renderizado = renderizarTemplateNotificacao(item.payload);
    await fs.writeFile(
      path.join(DIRETORIO_PREVIEWS, `${item.arquivoBase}.html`),
      renderizado.html,
      'utf8',
    );
    await fs.writeFile(
      path.join(DIRETORIO_PREVIEWS, `${item.arquivoBase}.txt`),
      `Assunto: ${renderizado.assunto}\n\n${renderizado.texto}\n`,
      'utf8',
    );
  }

  console.info(
    `✅ Pré-visualizações HTML/TXT com dados fictícios geradas em: ${DIRETORIO_PREVIEWS}`,
  );
}

main().catch((err) => {
  console.error('❌ Falha ao gerar pré-visualizações de e-mail:', err);
  process.exit(1);
});
