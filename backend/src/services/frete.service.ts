import type {
  CotacaoFrete,
  CotacaoFreteInput,
  ProvedorCotacaoFrete,
} from '../repositories/contracts/frete.contracts.js';

export interface FreteService {
  cotar(dados: CotacaoFreteInput): Promise<CotacaoFrete>;
}

export function createFreteService(provedor: ProvedorCotacaoFrete): FreteService {
  return {
    cotar(dados) {
      return provedor.cotar(dados);
    },
  };
}
