import type {
  ArmazenamentoFotosPeca,
  ArquivoArmazenado,
  PecaPersistida,
  PecaRepository,
  ProcessadorImagemPeca,
} from '../repositories/contracts/pecas.contracts.js';
import {
  unconfiguredArmazenamentoFotosPeca,
  unconfiguredPecaRepository,
  unconfiguredProcessadorImagemPeca,
} from '../repositories/unconfiguredPecas.repository.js';
import type { CriarPecaDados } from '../validators/peca.validator.js';
import { criarArmazenamentoFotosPeca } from '../config/fotosStorage.js';
import { prismaPecaRepository } from '../repositories/prismaPeca.repository.js';
import { sharpProcessadorImagemPeca } from '../utils/sharpImagemPeca.processor.js';

export interface PecaServiceDeps {
  readonly repository?: PecaRepository;
  readonly processadorImagem?: ProcessadorImagemPeca;
  readonly armazenamento?: ArmazenamentoFotosPeca;
}

export interface PecaService {
  /** Publica uma peça validada no ateliê informado. */
  criar(atelieId: string, dados: CriarPecaDados): Promise<PecaPersistida>;
}

/**
 * Regras de negócio da publicação de peças:
 * 1. Otimiza todas as fotos antes de qualquer gravação (nenhum efeito colateral em caso de falha).
 * 2. Armazena as fotos otimizadas; se uma falhar, remove as já armazenadas.
 * 3. Persiste a peça com status `DISPONIVEL` e as URLs das fotos, marcando a foto principal.
 *    Se a persistência falhar, remove as fotos armazenadas (compensação).
 */
export function createPecaService(deps?: PecaServiceDeps): PecaService {
  const repository = deps?.repository ?? unconfiguredPecaRepository;
  const processadorImagem = deps?.processadorImagem ?? unconfiguredProcessadorImagemPeca;
  const armazenamento = deps?.armazenamento ?? unconfiguredArmazenamentoFotosPeca;

  async function removerSemPropagar(arquivos: readonly ArquivoArmazenado[]): Promise<void> {
    if (arquivos.length === 0) return;
    try {
      await armazenamento.remover(arquivos.map((arquivo) => arquivo.caminho));
    } catch (err) {
      // A falha original é a relevante para o cliente; a limpeza órfã fica registrada para reprocessamento.
      console.error('⚠️ Falha ao remover fotos órfãs após erro na publicação da peça:', {
        quantidade: arquivos.length,
        erro: err instanceof Error ? err.message : typeof err,
      });
    }
  }

  return {
    async criar(atelieId, dados) {
      const otimizadas = [];
      for (const foto of dados.fotos) {
        otimizadas.push(
          await processadorImagem.otimizar({ conteudo: foto.conteudo, tipoMime: foto.tipoMime }),
        );
      }

      const armazenadas: ArquivoArmazenado[] = [];
      try {
        for (const imagem of otimizadas) {
          armazenadas.push(
            await armazenamento.salvar({
              atelieId,
              conteudo: imagem.conteudo,
              tipoMime: imagem.tipoMime,
              extensao: imagem.extensao,
            }),
          );
        }
      } catch (err) {
        await removerSemPropagar(armazenadas);
        throw err;
      }

      try {
        return await repository.criarComFotos({
          atelieId,
          titulo: dados.titulo,
          descricao: dados.descricao,
          tipologia: dados.tipologia,
          preco: dados.preco,
          pesoGramas: dados.pesoGramas,
          comprimentoCm: dados.comprimentoCm,
          larguraCm: dados.larguraCm,
          alturaCm: dados.alturaCm,
          isFragil: dados.isFragil,
          status: 'DISPONIVEL',
          fotos: armazenadas.map((arquivo, index) => ({
            url: arquivo.url,
            caminhoArmazenamento: arquivo.caminho,
            isPrincipal: index === dados.indiceFotoPrincipal,
          })),
        });
      } catch (err) {
        await removerSemPropagar(armazenadas);
        throw err;
      }
    },
  };
}

/**
 * Instância de produção: Prisma/PostgreSQL, otimização com sharp e o armazenamento selecionado
 * em `config/fotosStorage.ts` (Supabase Storage, disco local ou fail-closed 503).
 */
export const pecaService: PecaService = createPecaService({
  repository: prismaPecaRepository,
  processadorImagem: sharpProcessadorImagemPeca,
  armazenamento: criarArmazenamentoFotosPeca(),
});
