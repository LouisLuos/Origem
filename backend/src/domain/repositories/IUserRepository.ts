import { User, UserProps } from '../entities/User'

export type CreateUserData = Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findAll(): Promise<User[]>
  create(data: CreateUserData): Promise<User>
  updateName(email: string, name: string): Promise<User>
}

