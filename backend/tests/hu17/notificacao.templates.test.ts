import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DESIGN_TOKENS_ORIGEM_EMAIL,
  renderizarTemplateNotificacao,
} from '../../src/templates/notificacoes/index.js';

describe('HU-17 (T-NOT-03) — Templates responsivos multicanal Origem', () => {
  it('renderiza recibo consolidado de pagamento aprovado em BRL/PT-BR com escape HTML', () => {
    const out = renderizarTemplateNotificacao({
      template: 'PAGAMENTO_APROVADO_COMPRADOR',
      dados: {
        pedidoId: '11111111-1111-4111-8111-111111111111',
        codigoPedido: 'ORIGEM-2026-001',
        compradorNome: 'Ana <script>alert(1)</script>',
        metodoPagamento: 'PIX',
        aprovadoEm: '2026-11-22T17:30:00.000Z',
        valorTotalPecas: 340,
        valorTotalFrete: 42.5,
        valorTotalPedido: 382.5,
        itens: [
          {
            tituloPeca: 'Vaso Alto do Moura',
            atelieNome: 'Ateliê Vitalino',
            poloCultural: 'Caruaru',
            quantidade: 2,
            precoUnitario: 170,
            subtotalItem: 340,
          },
        ],
        urlAcompanhamento: 'https://origem.local/pedido/ORIGEM-2026-001',
      },
    });

    assert.match(out.assunto, /ORIGEM-2026-001/);
    assert.match(out.html, /#EFE1CB/i);
    assert.match(out.html, new RegExp(DESIGN_TOKENS_ORIGEM_EMAIL.terracota, 'i'));
    assert.match(out.html, /border-radius:\s*0/);
    assert.match(out.html, /R\$ 382,50/);
    assert.match(out.html, /22\/11\/2026/);
    assert.equal(out.html.includes('<script>'), false);
    assert.match(out.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(out.texto, /R\$ 382,50/);
  });

  it('renderiza aviso de nova encomenda ao ateliê com destaque de peça frágil e WhatsApp', () => {
    const out = renderizarTemplateNotificacao({
      template: 'NOVA_ENCOMENDA_ATELIE',
      dados: {
        pedidoId: '11111111-1111-4111-8111-111111111111',
        codigoPedido: 'ORIGEM-2026-002',
        subpedidoId: '22222222-2222-4222-8222-222222222222',
        atelieId: '33333333-3333-4333-8333-333333333333',
        atelieNome: 'Casa da Cerâmica',
        titularNome: 'Mestre José',
        aprovadoEm: '2026-11-16T14:00:00.000Z',
        dataLimitePostagem: '2026-11-25T23:59:59-03:00',
        valorItensAtelie: 250,
        valorFreteAtelie: 35,
        itens: [
          {
            tituloPeca: 'Escultura de Barro',
            quantidade: 1,
            valorUnitario: 250,
            subtotalItem: 250,
            isFragil: true,
          },
        ],
      },
    });

    assert.match(out.html, /Peça frágil/i);
    assert.match(out.html, /25\/11\/2026/);
    assert.match(out.html, /R\$ 250,00/);
    assert.equal(out.whatsappTemplateNome, 'origem_nova_encomenda_atelie_v1');
    assert.equal(out.whatsappParametros?.length, 5);
  });

  it('renderiza alerta urgente do 5º dia útil destacando risco de cancelamento e estorno', () => {
    const out = renderizarTemplateNotificacao({
      template: 'ALERTA_SLA_POSTAGEM_DIA5',
      dados: {
        pedidoId: '11111111-1111-4111-8111-111111111111',
        codigoPedido: 'ORIGEM-2026-003',
        subpedidoId: '44444444-4444-4444-8444-444444444444',
        atelieId: '33333333-3333-4333-8333-333333333333',
        atelieNome: 'Rendeiras de Pesqueira',
        titularNome: 'Mestra Socorro',
        diasUteisDecorridos: 5,
        prazoMaximoDiasUteis: 7,
        pagamentoAprovadoEm: '2026-11-16T12:00:00-03:00',
        dataLimitePostagem: '2026-11-25T23:59:59-03:00',
        resumoItens: ['Toalha Renascença'],
        modoPreviewFicticio: true,
      },
    });

    assert.match(out.assunto, /URGENTE/i);
    assert.match(out.html, /risco de cancelamento/i);
    assert.match(out.html, /estorno integral \(100%\)/i);
    assert.match(out.html, /DADOS FICTÍCIOS/);
    assert.match(out.whatsappTexto ?? '', /Risco de cancelamento automatico/i);
  });

  it('renderiza template reutilizável de atualização de status com código de rastreio', () => {
    const out = renderizarTemplateNotificacao({
      template: 'ATUALIZACAO_STATUS_PEDIDO',
      dados: {
        pedidoId: '11111111-1111-4111-8111-111111111111',
        codigoPedido: 'ORIGEM-2026-004',
        destinatarioNome: 'João',
        novoStatus: 'POSTADO',
        ocorrenciaEm: '2026-11-24T13:15:00-03:00',
        transportadora: 'Correios',
        codigoRastreio: 'PE987654321BR',
      },
    });

    assert.match(out.assunto, /Objeto postado/);
    assert.match(out.html, /PE987654321BR/);
    assert.match(out.texto, /PE987654321BR/);
  });
});
