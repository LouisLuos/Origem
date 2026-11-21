/**
 * Contratos da HU-04 (Parametrização do Ateliê e Endereço Físico de Origem).
 * Referências: references/backlog-priorizado-origem.md (HU-04, T-ATE-01/02) e
 * references/modelagem-inicial-origem.sql (`atelies`, `enderecos`).
 */

export interface EnderecoExpedicao {
  readonly cep: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento?: string;
  readonly bairro: string;
  readonly cidade: string;
  readonly uf: string;
}

export interface CriarAtelieComEnderecoInput {
  readonly artesaoId: string;
  readonly nomeComercial: string;
  readonly poloCultural: string;
  readonly endereco: EnderecoExpedicao;
}

export interface AteliePersistido {
  readonly id: string;
  readonly artesaoId: string;
  readonly nomeComercial: string;
  readonly poloCultural: string;
  readonly status: 'ATIVO' | 'SUSPENSO';
  readonly endereco: EnderecoExpedicao;
  readonly criadoEm: string;
}

export interface AtelieCadastroRepository {
  findArtesaoIdPorUsuarioId(usuarioId: string): Promise<string | null>;
  existeAteliePorArtesaoId(artesaoId: string): Promise<boolean>;
  /** Persiste ateliê e endereço em uma única transação (Cenário 1, relação 1:1 estrita). */
  criarAtelieComEndereco(dados: CriarAtelieComEnderecoInput): Promise<AteliePersistido>;
}
