import { Router } from 'express'
import { OrderCheckoutService } from '../../../application/services/OrderCheckoutService'
import { StockReservationService } from '../../../application/services/StockReservationService'
import { IArtisanRepository } from '../../../domain/repositories/IArtisanRepository'
import { IOrderRepository } from '../../../domain/repositories/IOrderRepository'
import { IProductRepository } from '../../../domain/repositories/IProductRepository'
import { IReviewRepository } from '../../../domain/repositories/IReviewRepository'
import { ArtisanController } from '../controllers/ArtisanController'
import { OrderController } from '../controllers/OrderController'
import { ProductController } from '../controllers/ProductController'
import { ReviewController } from '../controllers/ReviewController'
import { StockController } from '../controllers/StockController'
import { asyncHandler } from '../middlewares/asyncHandler'

export interface ApiV1RouterDependencies {
  productRepository: IProductRepository
  artisanRepository: IArtisanRepository
  orderRepository: IOrderRepository
  reviewRepository: IReviewRepository
  stockReservationService: StockReservationService
  orderCheckoutService: OrderCheckoutService
}

export function createApiV1Router(deps: ApiV1RouterDependencies): Router {
  const router = Router()

  const productController = new ProductController(deps.productRepository)
  const stockController = new StockController(deps.stockReservationService)
  const artisanController = new ArtisanController(deps.artisanRepository)
  const orderController = new OrderController(
    deps.orderCheckoutService,
    deps.orderRepository,
  )
  const reviewController = new ReviewController(deps.reviewRepository)

  // Produtos (/api/v1/produtos)
  router.get('/produtos', asyncHandler(productController.list))
  router.get('/produtos/:id', asyncHandler(productController.getById))
  router.post('/produtos', asyncHandler(productController.create))
  router.patch('/produtos/:id', asyncHandler(productController.update))
  router.delete('/produtos/:id', asyncHandler(productController.remove))

  // Estoque & Concorrência Pessimista (/api/v1/estoque/reservas)
  router.post('/estoque/reservas', asyncHandler(stockController.reserve))

  // Artesãos (/api/v1/artesaos)
  router.get('/artesaos', asyncHandler(artisanController.list))
  router.get('/artesaos/:id', asyncHandler(artisanController.getById))
  router.post('/artesaos', asyncHandler(artisanController.create))

  // Pedidos & Checkout (/api/v1/pedidos)
  router.get('/pedidos', asyncHandler(orderController.list))
  router.get('/pedidos/:id', asyncHandler(orderController.getById))
  router.post('/pedidos', asyncHandler(orderController.create))

  // Avaliações (/api/v1/avaliacoes)
  router.get('/avaliacoes', asyncHandler(reviewController.list))

  return router
}

