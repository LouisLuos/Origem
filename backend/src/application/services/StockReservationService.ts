import { DomainError, ProductUnavailableException } from '../../domain/errors'
import { Product } from '../../domain/entities/Product'
import {
  IProductRepository,
  IUnitOfWork,
  TransactionalRepositories,
} from '../../domain/repositories'
import { StockReservationLineInput } from '../dtos/StockReservationDto'

/**
 * Consolida linhas duplicadas do mesmo `productId` e ordena deterministicamente
 * por ID alfabético para prevenir Deadlocks de ciclo de espera no PostgreSQL
 * durante aquisições simultâneas de `SELECT ... FOR UPDATE`.
 */
export function normalizeAndSortReservationLines(
  lines: StockReservationLineInput[],
): StockReservationLineInput[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new DomainError('Informe ao menos uma linha de reserva.', 'EMPTY_RESERVATION_LINES', 400)
  }

  const aggregated = new Map<string, number>()

  for (const line of lines) {
    const productId = line.productId?.trim()
    const quantity = Number(line.quantity)

    if (!productId) {
      throw new DomainError('Campo obrigatório: productId.', 'MISSING_PRODUCT_ID', 400)
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new DomainError(
        'A quantidade de cada item deve ser um inteiro positivo.',
        'INVALID_QUANTITY',
        400,
      )
    }

    aggregated.set(productId, (aggregated.get(productId) ?? 0) + quantity)
  }

  return Array.from(aggregated.entries())
    .sort(([idA], [idB]) => idA.localeCompare(idB))
    .map(([productId, quantity]) => ({ productId, quantity }))
}

/**
 * Caso de uso de reserva e baixa atômica de estoque (RNF-01 / Rubrica FCCPD).
 * Tudo-ou-nada (ACID): se qualquer peça do carrinho estiver indisponível ou
 * sem saldo suficiente sob Lock Pessimista, nenhuma alteração é comitada.
 */
export class StockReservationService {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly productRepository: IProductRepository,
  ) {}

  /**
   * Executa a reserva e o decremento de estoque dentro de uma transação já aberta.
   * Reutilizável tanto pelo endpoint `/estoque/reservas` quanto pelo checkout completo `/pedidos`.
   */
  public async reserveWithinTransaction(
    txRepos: TransactionalRepositories,
    rawLines: StockReservationLineInput[],
  ): Promise<Map<string, Product>> {
    const sortedLines = normalizeAndSortReservationLines(rawLines)
    const reservedProducts = new Map<string, Product>()

    for (const line of sortedLines) {
      // 1. Adquire Lock Pessimista Exclusivo de tupla (SELECT ... FOR UPDATE)
      const lockedProduct = await txRepos.products.findByIdForUpdate(line.productId)

      if (!lockedProduct) {
        throw new ProductUnavailableException(line.productId)
      }

      // 2. Valida invariantes de disponibilidade e saldo sobre a versão bloqueada
      lockedProduct.assertCanReserve(line.quantity)

      // 3. Decrementa o estoque atomicamente dentro da transação
      const updatedProduct = await txRepos.products.decrementStock(
        line.productId,
        line.quantity,
      )
      reservedProducts.set(line.productId, updatedProduct)
    }

    return reservedProducts
  }

  /**
   * Reserva o estoque de todas as linhas informadas em uma transação ACID dedicada
   * e retorna o catálogo atualizado (contrato `POST /estoque/reservas`).
   */
  public async reserveStock(lines: StockReservationLineInput[]): Promise<Product[]> {
    await this.unitOfWork.executeInTransaction(async (txRepos) => {
      await this.reserveWithinTransaction(txRepos, lines)
    })

    const catalogPage = await this.productRepository.findAll({ page: 1, limit: 1000 })
    return catalogPage.items
  }
}

