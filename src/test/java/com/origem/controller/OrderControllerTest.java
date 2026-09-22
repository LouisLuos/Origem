package com.origem.controller;

import com.origem.dto.PurchaseRequest;
import com.origem.dto.PurchaseResponse;
import com.origem.model.Product;
import com.origem.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class OrderControllerTest {

    @Autowired
    private OrderController orderController;

    @Autowired
    private ProductRepository productRepository;

    private static final String TEST_PRODUCT_ID = "poc-ctrl-test-prod";

    @BeforeEach
    void setup() {
        productRepository.save(new Product(TEST_PRODUCT_ID, "Vaso Barro Maragogipinho", 2));
    }

    @Test
    @DisplayName("Endpoint de compra - Sucesso com estoque suficiente")
    void testPurchaseSuccess() {
        PurchaseRequest request = new PurchaseRequest(TEST_PRODUCT_ID, 1);
        ResponseEntity<PurchaseResponse> response = orderController.purchase(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().isSuccess());
        assertEquals(TEST_PRODUCT_ID, response.getBody().getProductId());
        assertEquals(1, response.getBody().getRemainingStock());
    }

    @Test
    @DisplayName("Endpoint de compra - Conflito de estoque insuficiente")
    void testPurchaseInsufficientStockThrowsConflict() {
        PurchaseRequest request = new PurchaseRequest(TEST_PRODUCT_ID, 5);

        try {
            orderController.purchase(request);
            fail("Deveria ter lançado InsufficientStockException");
        } catch (Exception e) {
            ResponseEntity<PurchaseResponse> errorResponse = orderController.handleInsufficientStock((com.origem.exception.InsufficientStockException) e);
            assertEquals(HttpStatus.CONFLICT, errorResponse.getStatusCode());
            assertNotNull(errorResponse.getBody());
            assertFalse(errorResponse.getBody().isSuccess());
        }
    }

    @Test
    @DisplayName("Endpoint utilitário - Consulta de produto existente")
    void testGetProduct() {
        ResponseEntity<Product> response = orderController.getProduct(TEST_PRODUCT_ID);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(TEST_PRODUCT_ID, response.getBody().getId());
        assertEquals("Vaso Barro Maragogipinho", response.getBody().getName());
    }

    @Test
    @DisplayName("Endpoint de compra - Retorna ID e status inicial 'pending' da notificação")
    void testPurchaseReturnsNotificationMetadata() {
        PurchaseRequest request = new PurchaseRequest(TEST_PRODUCT_ID, 1, "test-order-ctrl-123");
        ResponseEntity<PurchaseResponse> response = orderController.purchase(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertNotNull(response.getBody().getNotificationId());
        assertEquals("pending", response.getBody().getNotificationStatus());
        assertEquals("test-order-ctrl-123", response.getBody().getOrderId());

        // Valida que o endpoint GET /api/orders/notifications/{id} funciona
        ResponseEntity<com.origem.model.Notification> notifResponse =
                orderController.getNotification(response.getBody().getNotificationId());
        assertEquals(HttpStatus.OK, notifResponse.getStatusCode());
        assertNotNull(notifResponse.getBody());
    }
}
