package com.origem.controller;

import com.origem.dto.PurchaseRequest;
import com.origem.dto.PurchaseResponse;
import com.origem.exception.InsufficientStockException;
import com.origem.exception.ProductNotFoundException;
import com.origem.model.Product;
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

    public OrderController(OrderService orderService, ProductRepository productRepository) {
        this.orderService = orderService;
        this.productRepository = productRepository;
    }

    /**
     * Endpoint para simulação de compra com controle de concorrência.
     */
    @PostMapping("/purchase")
    public ResponseEntity<PurchaseResponse> purchase(@RequestBody PurchaseRequest request) {
        Product updatedProduct = orderService.purchaseProduct(request.getProductId(), request.getQuantity());
        return ResponseEntity.ok(PurchaseResponse.success(
                updatedProduct.getId(),
                updatedProduct.getName(),
                updatedProduct.getStock()
        ));
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
