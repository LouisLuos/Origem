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

/** Porta para provedores de cotação de frete. */
export interface ProvedorCotacaoFrete {
  readonly nome?: string;
  readonly configurado?: boolean;
  cotar(dados: CotacaoFreteInput): Promise<CotacaoFrete>;
}

export interface ItemFreteOrigemInput {
  readonly pecaId: string;
  readonly titulo: string;
  readonly quantidade: number;
  readonly cubagem: CubagemFrete;
  readonly atelieId: string;
  readonly atelieNome: string;
  readonly poloCultural: string;
  readonly cepOrigem: string | null;
}

export interface CotacaoFretePorOrigem {
  readonly atelieId: string;
  readonly atelieNome: string;
  readonly poloCultural: string;
  readonly cepOrigem: string;
  readonly cubagemConsolidada: CubagemFrete;
  readonly totalItens: number;
  readonly valorBrl: number;
  readonly valorCentavos: number;
  readonly prazoEstimadoDias: number;
}

export interface CotacaoFreteConsolidada {
  readonly cepDestino: string;
  readonly valorTotalFrete: number;
  readonly valorTotalFreteCentavos: number;
  readonly fretesPorOrigem: readonly CotacaoFretePorOrigem[];
}
