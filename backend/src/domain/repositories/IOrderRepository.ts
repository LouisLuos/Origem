import { Order, OrderProps } from '../entities/Order'

export type CreateOrderData = Omit<OrderProps, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date
}

export interface IOrderRepository {
  findAll(userEmail?: string): Promise<Order[]>
  findById(id: string): Promise<Order | null>
  create(data: CreateOrderData): Promise<Order>
}

