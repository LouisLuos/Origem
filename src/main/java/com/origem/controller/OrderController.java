package com.origem.controller;

import com.origem.dto.PurchaseRequest;
import com.origem.dto.PurchaseResponse;
import com.origem.dto.PurchaseResult;
import com.origem.exception.InsufficientStockException;
import com.origem.exception.ProductNotFoundException;
import com.origem.model.Notification;
import com.origem.model.Product;
import com.origem.repository.NotificationRepository;
import com.origem.repository.ProductRepository;
import com.origem.service.OrderService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;
    private final ProductRepository productRepository;
    private final NotificationRepository notificationRepository;

    public OrderController(OrderService orderService,
                           ProductRepository productRepository,
                           NotificationRepository notificationRepository) {
        this.orderService = orderService;
        this.productRepository = productRepository;
        this.notificationRepository = notificationRepository;
    }

    /**
     * Endpoint para simulação de compra com controle de concorrência e desacoplamento assíncrono.
     * Retorna HTTP 200 imediatamente com a notificação em status 'pending' antes da conclusão
     * do envio em segundo plano (2000ms).
     */
    @PostMapping("/purchase")
    public ResponseEntity<PurchaseResponse> purchase(@RequestBody PurchaseRequest request) {
        PurchaseResult result = orderService.purchaseProduct(
                request.getProductId(),
                request.getQuantity(),
                request.getOrderId()
        );

        return ResponseEntity.ok(PurchaseResponse.success(
                result.getProduct().getId(),
                result.getProduct().getName(),
                result.getProduct().getStock(),
                result.getNotification().getOrderId(),
                result.getNotification().getId(),
                result.getNotification().getStatus()
        ));
    }

    /**
     * Endpoint utilitário para consultar o status de processamento da notificação assíncrona.
     */
    @GetMapping("/notifications/{id}")
    public ResponseEntity<Notification> getNotification(@PathVariable String id) {
        return notificationRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Endpoint utilitário para consultar o estoque atual do produto.
     */
    @GetMapping("/products/{id}")
    public ResponseEntity<Product> getProduct(@PathVariable String id) {
        return productRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Endpoint utilitário para definir/resetar o estoque de um produto para fins de teste concorrente.
     */
    @PostMapping("/products/{id}/stock")
    public ResponseEntity<Product> setProductStock(@PathVariable String id, @RequestParam int stock) {
        Product product = productRepository.findById(id)
                .orElse(new Product(id, "Produto Teste", stock));
        product.setStock(stock);
        return ResponseEntity.ok(productRepository.save(product));
    }

    // Handlers de Exceção para respostas HTTP semânticas
    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<PurchaseResponse> handleInsufficientStock(InsufficientStockException ex) {
        // HTTP 409 Conflict conforme arquitetura FCCPD para estoque esgotado
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(PurchaseResponse.failure(null, ex.getMessage()));
    }

    @ExceptionHandler(ProductNotFoundException.class)
    public ResponseEntity<PurchaseResponse> handleProductNotFound(ProductNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(PurchaseResponse.failure(null, ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<PurchaseResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(PurchaseResponse.failure(null, ex.getMessage()));
    }
}
