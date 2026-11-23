import { FRETE_ERROR_CODES } from '../integrations/frete.provider.js';
import type {
  CotacaoFrete,
  CotacaoFreteConsolidada,
  CotacaoFreteInput,
  CotacaoFretePorOrigem,
  ItemFreteOrigemInput,
  ProvedorCotacaoFrete,
} from '../repositories/contracts/frete.contracts.js';
import { AppError } from '../utils/AppError.js';
import { centavosParaNumero, decimalParaCentavos, somarCentavos } from '../utils/dinheiro.util.js';

export interface FreteService {
  cotar(dados: CotacaoFreteInput): Promise<CotacaoFrete>;
  cotarMultiOrigem(
    itens: readonly ItemFreteOrigemInput[],
    cepDestino: string,
  ): Promise<CotacaoFreteConsolidada>;
}

const CEP_DIGITS_REGEX = /^\d{8}$/;

export function normalizarCepDigitos(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Consolida peso e cubagem por ateliê de origem (ADR-001) e consulta o provedor configurado
 * uma vez por origem distinta, retornando valores exatos em centavos e BRL.
 */
export async function cotarFretesPorOrigem(
  provedor: ProvedorCotacaoFrete,
  itens: readonly ItemFreteOrigemInput[],
  cepDestinoBruto: string,
): Promise<CotacaoFreteConsolidada> {
  if (provedor.configurado === false) {
    // Dispara imediatamente a falha explícita do provedor não configurado (503)
    return provedor
      .cotar({
        cepOrigem: '50000000',
        cepDestino: '50000000',
        cubagem: { pesoGramas: 100, comprimentoCm: 10, larguraCm: 10, alturaCm: 10 },
      })
      .then(() => {
        throw new AppError(
          'Provedor de frete não configurado.',
          503,
          FRETE_ERROR_CODES.PROVEDOR_FRETE_NAO_CONFIGURADO,
        );
      });
  }

  const cepDestino = normalizarCepDigitos(cepDestinoBruto);
  if (!CEP_DIGITS_REGEX.test(cepDestino)) {
    throw new AppError(
      'CEP de destino deve conter exatamente 8 dígitos numéricos.',
      422,
      FRETE_ERROR_CODES.CEP_DESTINO_INVALIDO,
    );
  }

  if (itens.length === 0) {
    throw new AppError('Não há itens para cotação de frete.', 422);
  }

  interface AcumuladorOrigem {
    readonly atelieId: string;
    readonly atelieNome: string;
    readonly poloCultural: string;
    readonly cepOrigem: string;
    pesoGramas: number;
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
    totalItens: number;
  }

  const origens = new Map<string, AcumuladorOrigem>();

  for (const item of itens) {
    const cepOrigem = item.cepOrigem ? normalizarCepDigitos(item.cepOrigem) : '';
    if (!CEP_DIGITS_REGEX.test(cepOrigem)) {
      throw new AppError(
        `O ateliê "${item.atelieNome}" não possui CEP de expedição válido cadastrado.`,
        422,
        FRETE_ERROR_CODES.ORIGEM_SEM_ENDERECO_EXPEDICAO,
      );
    }

    const existente = origens.get(item.atelieId);
    const pesoLote = item.cubagem.pesoGramas * item.quantidade;
    const alturaEmpilhada = item.cubagem.alturaCm * item.quantidade;

    if (!existente) {
      origens.set(item.atelieId, {
        atelieId: item.atelieId,
        atelieNome: item.atelieNome,
        poloCultural: item.poloCultural,
        cepOrigem,
        pesoGramas: pesoLote,
        comprimentoCm: item.cubagem.comprimentoCm,
        larguraCm: item.cubagem.larguraCm,
        alturaCm: alturaEmpilhada,
        totalItens: item.quantidade,
      });
    } else {
      existente.pesoGramas += pesoLote;
      existente.comprimentoCm = Math.max(existente.comprimentoCm, item.cubagem.comprimentoCm);
      existente.larguraCm = Math.max(existente.larguraCm, item.cubagem.larguraCm);
      existente.alturaCm += alturaEmpilhada;
      existente.totalItens += item.quantidade;
    }
  }

  const origensOrdenadas = Array.from(origens.values()).sort((a, b) =>
    a.atelieId < b.atelieId ? -1 : a.atelieId > b.atelieId ? 1 : 0,
  );

  const fretesPorOrigem: CotacaoFretePorOrigem[] = [];
  for (const origem of origensOrdenadas) {
    const cubagemConsolidada = {
      pesoGramas: origem.pesoGramas,
      comprimentoCm: origem.comprimentoCm,
      larguraCm: origem.larguraCm,
      alturaCm: origem.alturaCm,
    };

    const cotacao = await provedor.cotar({
      cepOrigem: origem.cepOrigem,
      cepDestino,
      cubagem: cubagemConsolidada,
    });

    const valorCentavos = decimalParaCentavos(cotacao.valorBrl);
    fretesPorOrigem.push({
      atelieId: origem.atelieId,
      atelieNome: origem.atelieNome,
      poloCultural: origem.poloCultural,
      cepOrigem: origem.cepOrigem,
      cubagemConsolidada,
      totalItens: origem.totalItens,
      valorBrl: centavosParaNumero(valorCentavos),
      valorCentavos,
      prazoEstimadoDias: cotacao.prazoEstimadoDias,
    });
  }

  const valorTotalFreteCentavos = somarCentavos(fretesPorOrigem.map((f) => f.valorCentavos));

  return {
    cepDestino,
    valorTotalFrete: centavosParaNumero(valorTotalFreteCentavos),
    valorTotalFreteCentavos,
    fretesPorOrigem,
  };
}

export function createFreteService(provedor: ProvedorCotacaoFrete): FreteService {
  return {
    cotar(dados) {
      return provedor.cotar(dados);
    },
    cotarMultiOrigem(itens, cepDestino) {
      return cotarFretesPorOrigem(provedor, itens, cepDestino);
    },
  };
}
