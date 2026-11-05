export type UserRoleType = 'buyer' | 'artisan' | 'admin'

export interface UserProps {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRoleType
  createdAt?: Date
  updatedAt?: Date
}

/**
 *Projeção segura do usuário omitindo sempre `passwordHash` (LGPD / Segurança).
 */
export interface SafeUserDto {
  id: string
  name: string
  email: string
  role: UserRoleType
}

export class User {
  public readonly id: string
  public readonly name: string
  public readonly email: string
  public readonly passwordHash: string
  public readonly role: UserRoleType
  public readonly createdAt?: Date
  public readonly updatedAt?: Date

  constructor(props: UserProps) {
    this.id = props.id
    this.name = props.name.trim()
    this.email = props.email.trim().toLowerCase()
    this.passwordHash = props.passwordHash
    this.role = props.role
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  public toSafeDto(): SafeUserDto {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
    }
  }
}

