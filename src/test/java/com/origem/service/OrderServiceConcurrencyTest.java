package com.origem.service;

import com.origem.exception.InsufficientStockException;
import com.origem.model.Product;
import com.origem.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class OrderServiceConcurrencyTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private ProductRepository productRepository;

    private static final String PRODUCT_ID = "poc-test-concurrency-item";

    @BeforeEach
    void setup() {
        // Inicializa ou reseta o produto no banco com estoque controlado = 3
        Product product = new Product(PRODUCT_ID, "Escultura Cerâmica Mestre Vitalino", 3);
        productRepository.save(product);
    }

    @Test
    @DisplayName("Garante atomicidade e ausência de Overselling sob alta concorrência simultânea")
    void testConcurrentPurchasesPreventOverselling() throws InterruptedException {
        int numberOfThreads = 10;
        int initialStock = 3;
        int purchaseQuantityPerThread = 1;

        ExecutorService executorService = Executors.newFixedThreadPool(numberOfThreads);
        CountDownLatch readyLatch = new CountDownLatch(numberOfThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(numberOfThreads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        List<Throwable> unexpectedExceptions = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < numberOfThreads; i++) {
            executorService.submit(() -> {
                readyLatch.countDown();
                try {
                    // Todas as threads aguardam o gatilho de início para disparar ao mesmo instante
                    startLatch.await();

                    orderService.purchaseProduct(PRODUCT_ID, purchaseQuantityPerThread);
                    successCount.incrementAndGet();
                } catch (InsufficientStockException e) {
                    // Falha esperada quando o estoque esgota
                    failureCount.incrementAndGet();
                } catch (Throwable t) {
                    unexpectedExceptions.add(t);
                } finally {
                    finishLatch.countDown();
                }
            });
        }

        // Aguarda todas as threads ficarem prontas
        readyLatch.await(5, TimeUnit.SECONDS);
        // Disparo simultâneo (corrida controlada)
        startLatch.countDown();
        // Aguarda a conclusão de todas as threads
        boolean finished = finishLatch.await(15, TimeUnit.SECONDS);

        executorService.shutdown();
        assertTrue(finished, "Todas as threads deveriam ter finalizado dentro do tempo limite.");
        assertTrue(unexpectedExceptions.isEmpty(), "Não deve haver exceções inesperadas: " + unexpectedExceptions);

        // Validação da regra de negócio concorrente
        assertEquals(initialStock, successCount.get(), "Exatamente 3 compras deveriam ter sucesso.");
        assertEquals(numberOfThreads - initialStock, failureCount.get(), "Exatamente 7 compras deveriam falhar por falta de estoque.");

        // Validação do estado persistido no banco
        Product updatedProduct = productRepository.findById(PRODUCT_ID).orElseThrow();
        assertEquals(0, updatedProduct.getStock(), "O estoque final no banco de dados deve ser estritamente zero.");
    }

    @Test
    @DisplayName("Garante que produtos distintos não bloqueiam a concorrência entre si")
    void testDistinctProductsDoNotBlockEachOther() throws InterruptedException {
        String prodA = "poc-test-prod-a";
        String prodB = "poc-test-prod-b";

        productRepository.save(new Product(prodA, "Peça A", 5));
        productRepository.save(new Product(prodB, "Peça B", 5));

        ExecutorService executorService = Executors.newFixedThreadPool(2);
        CountDownLatch latch = new CountDownLatch(2);

        AtomicInteger successCount = new AtomicInteger(0);

        executorService.submit(() -> {
            try {
                orderService.purchaseProduct(prodA, 2);
                successCount.incrementAndGet();
            } finally {
                latch.countDown();
            }
        });

        executorService.submit(() -> {
            try {
                orderService.purchaseProduct(prodB, 3);
                successCount.incrementAndGet();
            } finally {
                latch.countDown();
            }
        });

        boolean finished = latch.await(10, TimeUnit.SECONDS);
        executorService.shutdown();

        assertTrue(finished);
        assertEquals(2, successCount.get());

        assertEquals(3, productRepository.findById(prodA).orElseThrow().getStock());
        assertEquals(2, productRepository.findById(prodB).orElseThrow().getStock());
    }
}
