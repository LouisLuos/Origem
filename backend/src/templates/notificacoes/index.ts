import type { TemplateNotificacaoId } from '../../repositories/contracts/notificacoes.contracts.js';
import {
  renderizarAlertaSlaPostagem,
  type AlertaSlaPostagemDados,
} from './alertaSlaPostagem.template.js';
import {
  renderizarAtualizacaoStatusPedido,
  type AtualizacaoStatusPedidoDados,
} from './atualizacaoStatusPedido.template.js';
import {
  renderizarNovaEncomendaAtelie,
  type NovaEncomendaAtelieDados,
} from './novaEncomendaAtelie.template.js';
import {
  renderizarPagamentoAprovadoComprador,
  type PagamentoAprovadoCompradorDados,
} from './pagamentoAprovadoComprador.template.js';

export type PayloadTemplateNotificacao =
  | {
      readonly template: 'PAGAMENTO_APROVADO_COMPRADOR';
      readonly dados: PagamentoAprovadoCompradorDados;
    }
  | {
      readonly template: 'NOVA_ENCOMENDA_ATELIE';
      readonly dados: NovaEncomendaAtelieDados;
    }
  | {
      readonly template: 'ALERTA_SLA_POSTAGEM_DIA5';
      readonly dados: AlertaSlaPostagemDados;
    }
  | {
      readonly template: 'ATUALIZACAO_STATUS_PEDIDO';
      readonly dados: AtualizacaoStatusPedidoDados;
    };

export interface NotificacaoRenderizada {
  readonly template: TemplateNotificacaoId;
  readonly assunto: string;
  readonly html: string;
  readonly texto: string;
  readonly whatsappTemplateNome?: string;
  readonly whatsappParametros?: readonly string[];
  readonly whatsappTexto?: string;
}

export function renderizarTemplateNotificacao(
  entrada: PayloadTemplateNotificacao,
): NotificacaoRenderizada {
  switch (entrada.template) {
    case 'PAGAMENTO_APROVADO_COMPRADOR': {
      const render = renderizarPagamentoAprovadoComprador(entrada.dados);
      return { template: entrada.template, ...render };
    }
    case 'NOVA_ENCOMENDA_ATELIE': {
      const render = renderizarNovaEncomendaAtelie(entrada.dados);
      return { template: entrada.template, ...render };
    }
    case 'ALERTA_SLA_POSTAGEM_DIA5': {
      const render = renderizarAlertaSlaPostagem(entrada.dados);
      return { template: entrada.template, ...render };
    }
    case 'ATUALIZACAO_STATUS_PEDIDO': {
      const render = renderizarAtualizacaoStatusPedido(entrada.dados);
      return { template: entrada.template, ...render };
    }
  }
}

export {
  renderizarAlertaSlaPostagem,
  renderizarAtualizacaoStatusPedido,
  renderizarNovaEncomendaAtelie,
  renderizarPagamentoAprovadoComprador,
};
export {
  escapeHtml,
  formatarDataBr,
  formatarDataHoraBr,
  formatarMoedaBrl,
} from './formatters.js';
export { DESIGN_TOKENS_ORIGEM_EMAIL } from './layout.js';
export type {
  AlertaSlaPostagemDados,
  AtualizacaoStatusPedidoDados,
  NovaEncomendaAtelieDados,
  PagamentoAprovadoCompradorDados,
};
