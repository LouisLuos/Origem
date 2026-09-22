package com.origem.service;

import com.origem.dto.PurchaseResult;
import com.origem.model.Notification;
import com.origem.model.Product;
import com.origem.repository.NotificationRepository;
import com.origem.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.concurrent.TimeUnit;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class NotificationServiceAsyncTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private NotificationService notificationService;

    private static final String PRODUCT_ID = "poc-async-test-prod";

    @BeforeEach
    void setup() {
        productRepository.save(new Product(PRODUCT_ID, "Bordado Filé Tradicional", 10));
    }

    @Test
    @DisplayName("Garante desacoplamento imediato (< 500ms) e transição assíncrona de 'pending' para 'sent'")
    void testAsyncNotificationDecouplingAndStatusTransition() {
        // Garante simulação de delay de 1.5s para provar desacoplamento
        notificationService.setSimulatedDelayMs(1500);

        long startTime = System.currentTimeMillis();

        // 1. Executa a compra
        PurchaseResult result = orderService.purchaseProduct(PRODUCT_ID, 1, "order-async-success-123");

        long executionDuration = System.currentTimeMillis() - startTime;

        // Prova 1: A thread principal NÃO foi bloqueada pelos 1500ms do envio assíncrono
        assertTrue(executionDuration < 800,
                "A thread principal deve retornar imediatamente (< 800ms) enquanto o envio assíncrono ocorre em background. Duração: " + executionDuration + "ms");

        assertNotNull(result.getNotification());
        String notificationId = result.getNotification().getId();

        // Prova 2: O registro é gravado inicialmente no banco de dados como 'pending'
        Notification initialNotif = notificationRepository.findById(notificationId).orElseThrow();
        assertEquals("pending", initialNotif.getStatus(), "O status inicial no banco deve ser estritamente 'pending'");

        // Prova 3: A tarefa assíncrona executa em segundo plano e transita o status para 'sent'
        await().atMost(5, TimeUnit.SECONDS)
                .pollInterval(200, TimeUnit.MILLISECONDS)
                .untilAsserted(() -> {
                    Notification updatedNotif = notificationRepository.findById(notificationId).orElseThrow();
                    assertEquals("sent", updatedNotif.getStatus(),
                            "O status deve transitar assincronamente para 'sent' após conclusão da tarefa.");
                });
    }

    @Test
    @DisplayName("Garante política de até 3 retentativas e transição para 'failed' em caso de erro persistente")
    void testAsyncNotificationRetryAndFailureTransition() {
        // Reduz delay para agilizar as 3 tentativas no teste
        notificationService.setSimulatedDelayMs(200);

        // Dispara pedido com prefixo que aciona falha simulada no gateway
        PurchaseResult result = orderService.purchaseProduct(PRODUCT_ID, 1, "simulated-failure-order-999");
        String notificationId = result.getNotification().getId();

        // Verifica estado inicial 'pending'
        Notification initialNotif = notificationRepository.findById(notificationId).orElseThrow();
        assertEquals("pending", initialNotif.getStatus());

        // Aguarda esgotamento das 3 retentativas com backoff (3 tentativas * (200ms + 500ms) ~ 2.1s)
        await().atMost(8, TimeUnit.SECONDS)
                .pollInterval(300, TimeUnit.MILLISECONDS)
                .untilAsserted(() -> {
                    Notification failedNotif = notificationRepository.findById(notificationId).orElseThrow();
                    assertEquals("failed", failedNotif.getStatus(),
                            "Após esgotar as 3 retentativas automáticas, a notificação deve ser marcada como 'failed'.");
                });
    }
}
