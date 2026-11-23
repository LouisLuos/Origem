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
  cotar(dados: CotacaoFreteInput): Promise<CotacaoFrete>;
}
