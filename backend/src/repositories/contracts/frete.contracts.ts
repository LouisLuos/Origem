export const FRETE_ERROR_CODES = {
  FRETE_DADOS_INVALIDOS: 'FRETE_DADOS_INVALIDOS',
  PECA_NAO_ENCONTRADA: 'PECA_NAO_ENCONTRADA',
  ORIGEM_FRETE_INDISPONIVEL: 'ORIGEM_FRETE_INDISPONIVEL',
} as const;

export type FreteErrorCode = (typeof FRETE_ERROR_CODES)[keyof typeof FRETE_ERROR_CODES];

export interface CubagemFrete {
  readonly pesoGramas: number;
  readonly comprimentoCm: number;
  readonly larguraCm: number;
  readonly alturaCm: number;
}

export interface CotacaoFreteInput {
  readonly cepOrigem: string;
  readonly cepDestino: string;
  readonly cubagem: CubagemFrete;
}

export interface CotacaoFrete {
  readonly valorBrl: number;
  readonly prazoEstimadoDias: number;
}

/** Porta para provedores de cotação de frete (DIP / Ports & Adapters). */
export interface ProvedorCotacaoFrete {
  cotar(dados: CotacaoFreteInput): Promise<CotacaoFrete>;
}

/**
 * Dados logísticos internos de uma peça para simulação de envio.
 * `cepOrigem` é utilizado apenas no backend para o cálculo e NUNCA deve ser exposto
 * na resposta pública ao visitante/comprador (LGPD — RNF-11).
 */
export interface OrigemLogisticaPeca {
  readonly pecaId: string;
  readonly cepOrigem: string;
  readonly cubagem: CubagemFrete;
  readonly isFragil?: boolean;
}

/** Porta de repositório para obtenção de CEP de origem do ateliê e cubagem da peça. */
export interface FonteLogisticaPecaRepository {
  buscarOrigemLogisticaPorPecaId(pecaId: string): Promise<OrigemLogisticaPeca | null>;
}

export interface SimularFretePecaInput {
  readonly pecaId: string;
  readonly cepDestino: string;
}

export interface SimulacaoFretePecaResultado extends CotacaoFrete {
  readonly pecaId: string;
  readonly cepDestino: string;
}
