export interface DadosEnderecoComprador {
  readonly cep: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento?: string;
  readonly bairro: string;
  readonly cidade: string;
  readonly uf: string;
}

export interface EnderecoComprador extends DadosEnderecoComprador {
  readonly id: string;
  readonly criadoEm: string;
}

export type ResultadoCriacaoEndereco =
  | { readonly status: 'CRIADO'; readonly endereco: EnderecoComprador }
  | { readonly status: 'LIMITE_ATINGIDO' };

export interface EnderecoCompradorRepository {
  listarPorUsuario(usuarioId: string): Promise<EnderecoComprador[]>;
  /** Conta e cria na mesma transação, com o usuário travado, para que cadastros simultâneos não ultrapassem o limite. */
  criarRespeitandoLimite(
    usuarioId: string,
    dados: DadosEnderecoComprador,
    limite: number,
  ): Promise<ResultadoCriacaoEndereco>;
  atualizar(
    usuarioId: string,
    enderecoId: string,
    dados: DadosEnderecoComprador,
  ): Promise<EnderecoComprador | null>;
  remover(usuarioId: string, enderecoId: string): Promise<boolean>;
}
