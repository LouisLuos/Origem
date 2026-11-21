/**
 * Contratos de domínio e interfaces de repositório da HU-03 (Especialização de Artesão Titular
 * e Blindagem de Curadoria). Implementações reais: repositories/prismaHu03.repository.ts.
 *
 * Referências normativas:
 * - references/modelagem-inicial-origem.sql
 * - references/backlog-priorizado-origem.md (HU-03, HU-04, HU-18)
 *
 * LACUNAS L1–L4 — SITUAÇÃO:
 * - [L1] RESOLVIDA: `UNIQUE (usuario_id, papel)` em `usuarios_papeis` (migration hu01_auth) e
 *        inserção idempotente via `upsert`.
 * - [L2] RESOLVIDA: `desvincularCuradorDoAtelie` remove o papel global `CURADOR` somente quando não
 *        resta nenhum vínculo em `atelies_curadores`; demais papéis e vínculos são preservados.
 * - [L3] RESOLVIDA: habilitação, vinculação e desvinculação executam em `prisma.$transaction`.
 * - [L4] DECIDIDA: a alteração de Chave Pix permanece no escopo do ateliê
 *        (`PATCH /api/v1/atelies/:atelieId/chave-pix`). O Cenário 2 da HU-03 trata da "chave Pix
 *        do ateliê" e nenhum critério da HU-03/HU-04 exige alteração antes de o ateliê existir; a
 *        Chave Pix é cadastrada na habilitação (Cenário 1). Nenhum endpoint adicional foi criado.
 */

export type PapelUsuario = 'COMPRADOR' | 'ARTESAO' | 'CURADOR' | 'ADMIN';

export type PapelNoAtelie = 'TITULAR' | 'CURADOR';

export type StatusAtelie = 'ATIVO' | 'SUSPENSO';

export type StatusUsuario = 'ATIVO' | 'INATIVO' | 'SUSPENSO';

export type TipoChavePix = 'CPF' | 'EMAIL' | 'TELEFONE' | 'EVP';

export type OperacaoAtelie =
  | 'ALTERAR_CHAVE_PIX'
  | 'CONSULTAR_DADOS_FINANCEIROS'
  | 'GERENCIAR_CURADORES'
  | 'GERENCIAR_CATALOGO'
  | 'GERENCIAR_ETIQUETAS';

export const PERMISSOES_TITULAR_ATELIE: readonly OperacaoAtelie[] = [
  'ALTERAR_CHAVE_PIX',
  'CONSULTAR_DADOS_FINANCEIROS',
  'GERENCIAR_CURADORES',
  'GERENCIAR_CATALOGO',
  'GERENCIAR_ETIQUETAS',
] as const;

export const PERMISSOES_CURADOR_ATELIE: readonly OperacaoAtelie[] = [
  'GERENCIAR_CATALOGO',
  'GERENCIAR_ETIQUETAS',
] as const;

export interface UsuarioAtivoResumo {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly status: StatusUsuario;
}

export interface ArtesaoPerfilRegistro {
  readonly id: string;
  readonly usuarioId: string;
  readonly biografiaCultural: string;
  readonly tipoChavePix?: TipoChavePix;
  readonly chavePixCriptografada: string;
  readonly criadoEm?: string;
  readonly atualizadoEm?: string;
}

export interface HabilitarArtesaoPersistenciaInput {
  readonly usuarioId: string;
  readonly biografiaCultural: string;
  readonly tipoChavePix: TipoChavePix;
  readonly chavePixCriptografada: string;
}

export interface RelacionamentoUsuarioAtelie {
  readonly atelieId: string;
  readonly nomeComercial?: string;
  readonly statusAtelie: StatusAtelie;
  readonly ehTitular: boolean;
  readonly ehCuradorVinculado: boolean;
}

export interface ContextoAcessoAtelie {
  readonly atelieId: string;
  readonly nomeComercial?: string;
  readonly statusAtelie: StatusAtelie;
  readonly papelNoAtelie: PapelNoAtelie;
  readonly permissoes: readonly OperacaoAtelie[];
}

export interface DadosFinanceirosAteliePersistidos {
  readonly atelieId: string;
  readonly artesaoId: string;
  readonly titularUsuarioId: string;
  readonly tipoChavePix?: TipoChavePix;
  readonly chavePixCriptografada: string;
  readonly atualizadoEm?: string;
}

export interface AtualizacaoChavePixPersistida {
  readonly atelieId: string;
  readonly artesaoId: string;
  readonly tipoChavePix: TipoChavePix;
  readonly atualizadoEm: string;
}

export interface CuradorVinculoPersistido {
  readonly vinculoId: string;
  readonly atelieId: string;
  readonly usuarioId: string;
  readonly nome: string;
  readonly email: string;
  readonly criadoEm: string;
}

/**
 * Contrato de persistência para habilitação de artesão titular (T-ART-02).
 * Nota de domínio: a habilitação NÃO cria o registro de `atelies` (fronteira reservada à HU-04).
 */
export interface HabilitacaoArtesaoRepository {
  findUsuarioPorId(usuarioId: string): Promise<UsuarioAtivoResumo | null>;
  findArtesaoPorUsuarioId(usuarioId: string): Promise<ArtesaoPerfilRegistro | null>;
  /**
   * Deve persistir o registro em `artesaos` com `chave_pix_criptografada` e associar
   * o papel `ARTESAO` em `usuarios_papeis` em uma única transação atômica (pendências L1 e L3).
   */
  habilitarArtesaoComPapel(dados: HabilitarArtesaoPersistenciaInput): Promise<ArtesaoPerfilRegistro>;
}

/**
 * Contrato de consulta contextual de titularidade e vínculo de curadoria por ateliê (T-ART-03).
 */
export interface AtelieAutorizacaoRepository {
  findRelacionamentoUsuarioAtelie(
    usuarioId: string,
    atelieId: string,
  ): Promise<RelacionamentoUsuarioAtelie | null>;
  listRelacionamentosUsuario(usuarioId: string): Promise<RelacionamentoUsuarioAtelie[]>;
}

/**
 * Contrato de leitura e atualização de Chave Pix protegida no escopo do ateliê (T-ART-02 / T-ART-03).
 */
export interface AtelieFinanceiroRepository {
  findDadosFinanceirosPorAtelie(atelieId: string): Promise<DadosFinanceirosAteliePersistidos | null>;
  atualizarChavePixCriptografada(
    atelieId: string,
    chavePixCriptografada: string,
    tipoChavePix: TipoChavePix,
  ): Promise<AtualizacaoChavePixPersistida>;
}

/**
 * Contrato de gestão de curadores operacionais vinculados ao ateliê (T-ART-04).
 */
export interface CuradorVinculoRepository {
  findUsuarioPorEmail(emailNormalizado: string): Promise<UsuarioAtivoResumo | null>;
  findVinculo(atelieId: string, usuarioId: string): Promise<CuradorVinculoPersistido | null>;
  listVinculosPorAtelie(atelieId: string): Promise<CuradorVinculoPersistido[]>;
  /**
   * Deve criar o vínculo único em `atelies_curadores` (e garantir o papel `CURADOR` sem remover
   * outros papéis) em transação atômica (pendências L1, L2 e L3).
   */
  vincularCuradorNoAtelie(
    atelieId: string,
    curadorUsuarioId: string,
  ): Promise<CuradorVinculoPersistido>;
  /**
   * Deve remover o vínculo do ateliê e avaliar o ciclo de vida do papel `CURADOR` quando não
   * restarem vínculos em outros ateliês (pendências L2 e L3).
   */
  desvincularCuradorDoAtelie(atelieId: string, curadorUsuarioId: string): Promise<boolean>;
}
