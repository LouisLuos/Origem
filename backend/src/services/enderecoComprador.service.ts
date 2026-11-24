import type {
  DadosEnderecoComprador,
  EnderecoComprador,
  EnderecoCompradorRepository,
} from '../repositories/contracts/hu11.contracts.js';
import { prismaEnderecoCompradorRepository } from '../repositories/prismaEnderecoComprador.repository.js';
import { AppError } from '../utils/AppError.js';

/** HU-11, Cenário 3. */
export const LIMITE_ENDERECOS_COMPRADOR = 5;

export const MENSAGEM_LIMITE_ENDERECOS =
  `Você já possui ${LIMITE_ENDERECOS_COMPRADOR} endereços salvos. Remova ou edite um endereço existente para cadastrar outro.`;

function naoEncontrado(): AppError {
  return new AppError('Endereço não encontrado.', 404, 'ENDERECO_NAO_ENCONTRADO');
}

export interface EnderecoCompradorService {
  listar(usuarioId: string): Promise<EnderecoComprador[]>;
  criar(usuarioId: string, dados: DadosEnderecoComprador): Promise<EnderecoComprador>;
  atualizar(
    usuarioId: string,
    enderecoId: string,
    dados: DadosEnderecoComprador,
  ): Promise<EnderecoComprador>;
  remover(usuarioId: string, enderecoId: string): Promise<void>;
}

export function createEnderecoCompradorService(
  repository: EnderecoCompradorRepository = prismaEnderecoCompradorRepository,
): EnderecoCompradorService {
  return {
    listar(usuarioId) {
      return repository.listarPorUsuario(usuarioId);
    },

    async criar(usuarioId, dados) {
      const resultado = await repository.criarRespeitandoLimite(
        usuarioId,
        dados,
        LIMITE_ENDERECOS_COMPRADOR,
      );
      if (resultado.status === 'LIMITE_ATINGIDO') {
        throw new AppError(MENSAGEM_LIMITE_ENDERECOS, 422, 'LIMITE_ENDERECOS_ATINGIDO');
      }
      return resultado.endereco;
    },

    async atualizar(usuarioId, enderecoId, dados) {
      const atualizado = await repository.atualizar(usuarioId, enderecoId, dados);
      if (!atualizado) throw naoEncontrado();
      return atualizado;
    },

    async remover(usuarioId, enderecoId) {
      if (!(await repository.remover(usuarioId, enderecoId))) throw naoEncontrado();
    },
  };
}

export const enderecoCompradorService = createEnderecoCompradorService();
