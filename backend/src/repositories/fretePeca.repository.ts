import { isUuid } from '../utils/uuid.util.js';
import { loadCatalogPayload } from './catalogLoader.js';
import type {
  CubagemFrete,
  FonteLogisticaPecaRepository,
  OrigemLogisticaPeca,
} from './contracts/frete.contracts.js';

/**
 * CEPs de referência das sedes dos polos culturais de Pernambuco, usados como fallback
 * caso um ateliê ou peça do catálogo legado (`p01`..`p14`) não possua registro em `enderecos`.
 */
export const CEP_REFERENCIA_POR_POLO: Record<string, string> = {
  'alto do moura': '55040120',
  caruaru: '55002000',
  tracunhaem: '55805000',
  'nazare da mata': '55800000',
  bezerros: '55660000',
  garanhuns: '55292000',
  pesqueira: '55200000',
  goiana: '55900000',
  passira: '55650000',
  olinda: '53020000',
  petrolina: '56302000',
};

const CEP_PADRAO_PERNAMBUCO = '50030000';

const CUBAGEM_PADRAO_LEGADO: CubagemFrete = {
  pesoGramas: 850,
  comprimentoCm: 24,
  larguraCm: 18,
  alturaCm: 15,
};

function normalizarPolo(polo: string): string {
  return polo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function resolverCepPorPoloCultural(polo?: string | null): string {
  if (!polo) return CEP_PADRAO_PERNAMBUCO;
  const norm = normalizarPolo(polo);
  for (const [chave, cep] of Object.entries(CEP_REFERENCIA_POR_POLO)) {
    if (norm.includes(chave)) return cep;
  }
  return CEP_PADRAO_PERNAMBUCO;
}

export class PrismaFonteLogisticaPecaRepository implements FonteLogisticaPecaRepository {
  async buscarOrigemLogisticaPorPecaId(pecaId: string): Promise<OrigemLogisticaPeca | null> {
    const trimmedId = pecaId.trim();

    if (isUuid(trimmedId)) {
      try {
        const { prisma } = await import('../config/database.js');
        const peca = await prisma.peca.findFirst({
          where: {
            id: trimmedId,
            status: { in: ['DISPONIVEL', 'RESERVADA', 'VENDIDA'] },
          },
          select: {
            id: true,
            pesoGramas: true,
            comprimentoCm: true,
            larguraCm: true,
            alturaCm: true,
            isFragil: true,
            atelie: {
              select: {
                poloCultural: true,
                endereco: { select: { cep: true } },
              },
            },
          },
        });

        if (!peca) return null;

        const cepBruto = peca.atelie.endereco?.cep?.replace(/\D/g, '') ?? '';
        const cepOrigem =
          cepBruto.length === 8
            ? cepBruto
            : resolverCepPorPoloCultural(peca.atelie.poloCultural);

        return {
          pecaId: peca.id,
          cepOrigem,
          cubagem: {
            pesoGramas: peca.pesoGramas,
            comprimentoCm: peca.comprimentoCm,
            larguraCm: peca.larguraCm,
            alturaCm: peca.alturaCm,
          },
          isFragil: peca.isFragil,
        };
      } catch {
        return null;
      }
    }

    // Fallback para peças do catálogo legado (p01..p14)
    const legado = (loadCatalogPayload().produtos ?? []).find((item) => item.id === trimmedId);
    if (!legado) return null;

    return {
      pecaId: legado.id,
      cepOrigem: resolverCepPorPoloCultural(legado.polo),
      cubagem: CUBAGEM_PADRAO_LEGADO,
      isFragil: legado.tecnica === 'ceramica',
    };
  }
}

export const prismaFonteLogisticaPecaRepository = new PrismaFonteLogisticaPecaRepository();
