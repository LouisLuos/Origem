import { DomainError } from '../errors'

export interface ArtisanProps {
  id: string
  name: string
  hub: string
  technique: string
  bio: string
  since: number
  photoUrl: string
  photoAlt: string
  coverUrl: string
  coverAlt: string
  email?: string | null
  phone?: string | null
  workshopAddress?: string | null
  publicContactConsent?: boolean
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Perfil público do artesão em estrita conformidade com a LGPD (Lei nº 13.709/2018)
 * e com o contrato `Artisan` do frontend (`artisanService.ts`).
 * Dados de contato direto e endereço físico de ateliê NUNCA são expostos sem consentimento explícito.
 */
export interface PublicArtisanProfileDto {
  id: string
  name: string
  hub: string
  technique: string
  bio: string
  since: number
  photoUrl: string
  photoAlt: string
  coverUrl: string
  coverAlt: string
  publicEmail?: string
  publicPhone?: string
  publicWorkshopAddress?: string
}

export class Artisan {
  public readonly id: string
  public readonly name: string
  public readonly hub: string
  public readonly technique: string
  public readonly bio: string
  public readonly since: number
  public readonly photoUrl: string
  public readonly photoAlt: string
  public readonly coverUrl: string
  public readonly coverAlt: string
  public readonly email: string | null
  public readonly phone: string | null
  public readonly workshopAddress: string | null
  public readonly publicContactConsent: boolean
  public readonly createdAt?: Date
  public readonly updatedAt?: Date

  constructor(props: ArtisanProps) {
    if (!props.photoAlt?.trim() || !props.coverAlt?.trim()) {
      throw new DomainError(
        'Atributos photoAlt e coverAlt descritivos são obrigatórios (RNF-07 / WCAG 2.1 AA).',
        'MISSING_ARTISAN_ALT',
        400,
      )
    }

    this.id = props.id
    this.name = props.name
    this.hub = props.hub
    this.technique = props.technique
    this.bio = props.bio
    this.since = props.since
    this.photoUrl = props.photoUrl
    this.photoAlt = props.photoAlt
    this.coverUrl = props.coverUrl
    this.coverAlt = props.coverAlt
    this.email = props.email ? props.email.trim().toLowerCase() : null
    this.phone = props.phone ?? null
    this.workshopAddress = props.workshopAddress ?? null
    this.publicContactConsent = props.publicContactConsent ?? false
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  /**
   * Projeta o perfil público omitindo dados pessoais sensíveis caso
   * `publicContactConsent` seja `false` (Salvaguarda LGPD - AGENTS.md Seção 3.6).
   */
  public toPublicProfileDto(): PublicArtisanProfileDto {
    return {
      id: this.id,
      name: this.name,
      hub: this.hub,
      technique: this.technique,
      bio: this.bio,
      since: this.since,
      photoUrl: this.photoUrl,
      photoAlt: this.photoAlt,
      coverUrl: this.coverUrl,
      coverAlt: this.coverAlt,
      ...(this.publicContactConsent && this.email ? { publicEmail: this.email } : {}),
      ...(this.publicContactConsent && this.phone ? { publicPhone: this.phone } : {}),
      ...(this.publicContactConsent && this.workshopAddress
        ? { publicWorkshopAddress: this.workshopAddress }
        : {}),
    }
  }
}

