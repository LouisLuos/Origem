import {
  FRETE_ERROR_CODES,
  type CotacaoFrete,
  type CotacaoFreteInput,
  type FonteLogisticaPecaRepository,
  type ProvedorCotacaoFrete,
  type SimulacaoFretePecaResultado,
  type SimularFretePecaInput,
} from '../repositories/contracts/frete.contracts.js';
import { prismaFonteLogisticaPecaRepository } from '../repositories/fretePeca.repository.js';
import { AppError } from '../utils/AppError.js';

/**
 * Provedor de cotação logística baseado no CEP de origem do ateliê, CEP de destino
 * e cubagem física da peça (peso real vs. peso cubado IATA/Correios: C*L*A / 6000 kg) — HU-07 Cenário 3.
 * Implementa a porta `ProvedorCotacaoFrete` (DIP / OCP), permitindo substituição transparente
 * por adaptadores HTTP externos sem alterar o caso de uso.
 */
export class TabeladoLogisticaFreteProvider implements ProvedorCotacaoFrete {
  async cotar(dados: CotacaoFreteInput): Promise<CotacaoFrete> {
    const prefixoOrigem = Number.parseInt(dados.cepOrigem.slice(0, 2), 10) || 50;
    const prefixoDestino = Number.parseInt(dados.cepDestino.slice(0, 2), 10) || 50;

    // Fator de cubagem rodoviária/postal: (C * L * A) / 6000 em kg -> converte para gramas
    const volumeCm3 =
      Math.max(1, dados.cubagem.comprimentoCm) *
      Math.max(1, dados.cubagem.larguraCm) *
      Math.max(1, dados.cubagem.alturaCm);
    const pesoCubadoGramas = Math.ceil((volumeCm3 / 6000) * 1000);
    const pesoTaxavelGramas = Math.max(dados.cubagem.pesoGramas, pesoCubadoGramas);
    const quilosAdicionais = Math.max(0, Math.ceil((pesoTaxavelGramas - 1000) / 1000));

    let tarifaBaseBrl: number;
    let prazoBaseDias: number;

    const origemEmPernambuco = prefixoOrigem >= 50 && prefixoOrigem <= 56;
    const destinoEmPernambuco = prefixoDestino >= 50 && prefixoDestino <= 56;
    const destinoNoNordeste =
      (prefixoDestino >= 40 && prefixoDestino <= 49) ||
      (prefixoDestino >= 50 && prefixoDestino <= 65);

    if (origemEmPernambuco && destinoEmPernambuco) {
      // Mesma sub-região de CEP (ex.: RMR ou mesmo polo do Agreste)
      const mesmaSubRegiao = dados.cepOrigem.slice(0, 3) === dados.cepDestino.slice(0, 3);
      tarifaBaseBrl = mesmaSubRegiao ? 14.9 : 19.9;
      prazoBaseDias = mesmaSubRegiao ? 2 : 3;
    } else if (destinoNoNordeste) {
      tarifaBaseBrl = 26.9;
      prazoBaseDias = 5;
    } else if (
      (prefixoDestino >= 1 && prefixoDestino <= 39) ||
      (prefixoDestino >= 70 && prefixoDestino <= 79)
    ) {
      // Sudeste e Centro-Oeste
      tarifaBaseBrl = 34.9;
      prazoBaseDias = 7;
    } else {
      // Norte e Sul
      tarifaBaseBrl = 42.9;
      prazoBaseDias = 9;
    }

    const adicionalPesoBrl = quilosAdicionais * 4.5;
    const valorBrl = Number((tarifaBaseBrl + adicionalPesoBrl).toFixed(2));
    const prazoEstimadoDias = prazoBaseDias + (quilosAdicionais > 5 ? 1 : 0);

    return {
      valorBrl,
      prazoEstimadoDias,
    };
  }
}

export const tabeladoLogisticaFreteProvider = new TabeladoLogisticaFreteProvider();

export interface FreteService {
  cotar(dados: CotacaoFreteInput): Promise<CotacaoFrete>;
  simularParaPeca(input: SimularFretePecaInput): Promise<SimulacaoFretePecaResultado>;
}

export function createFreteService(
  provedor: ProvedorCotacaoFrete = tabeladoLogisticaFreteProvider,
  fontePeca: FonteLogisticaPecaRepository = prismaFonteLogisticaPecaRepository,
): FreteService {
  return {
    cotar(dados) {
      return provedor.cotar(dados);
    },

    async simularParaPeca(input: SimularFretePecaInput): Promise<SimulacaoFretePecaResultado> {
      const origem = await fontePeca.buscarOrigemLogisticaPorPecaId(input.pecaId);

      if (!origem) {
        throw new AppError(
          `Peça com id '${input.pecaId}' não encontrada para simulação de frete.`,
          404,
          FRETE_ERROR_CODES.PECA_NAO_ENCONTRADA,
        );
      }

      const cotacao = await provedor.cotar({
        cepOrigem: origem.cepOrigem,
        cepDestino: input.cepDestino,
        cubagem: origem.cubagem,
      });

      // Respeita a LGPD (RNF-11): não retorna `cepOrigem` do ateliê no payload público
      return {
        pecaId: origem.pecaId,
        cepDestino: input.cepDestino,
        valorBrl: cotacao.valorBrl,
        prazoEstimadoDias: cotacao.prazoEstimadoDias,
      };
    },
  };
}

export const freteService = createFreteService();
