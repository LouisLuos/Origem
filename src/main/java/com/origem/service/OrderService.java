package com.origem.service;

import com.origem.dto.PurchaseResult;
import com.origem.exception.InsufficientStockException;
import com.origem.exception.ProductNotFoundException;
import com.origem.model.Notification;
import com.origem.model.Product;
import com.origem.repository.NotificationRepository;
import com.origem.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final ProductRepository productRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final TransactionTemplate transactionTemplate;

    // Mapa de locks por ID do produto: garante que requisições para o mesmo produto entrem em fila,
    // enquanto requisições para produtos distintos executam em paralelo.
    // O fair lock (true) garante política FIFO estrita na disputa pelo lock do mesmo produto.
    private final ConcurrentHashMap<String, ReentrantLock> productLocks = new ConcurrentHashMap<>();

    public OrderService(ProductRepository productRepository,
                        NotificationRepository notificationRepository,
                        NotificationService notificationService,
                        TransactionTemplate transactionTemplate) {
        this.productRepository = productRepository;
        this.notificationRepository = notificationRepository;
        this.notificationService = notificationService;
        this.transactionTemplate = transactionTemplate;
    }

    /**
     * Sobrecarga de conveniência que gera um UUID automático para o pedido.
     */
    public PurchaseResult purchaseProduct(String productId, int quantity) {
        return purchaseProduct(productId, quantity, UUID.randomUUID().toString());
    }

    /**
     * Realiza a compra de um produto de forma concorrente e segura, registrando a notificação
     * imediatamente como 'pending' e disparando o envio assíncrono desacoplado.
     *
     * Padrão Arquitetural Crítico:
     * 1. O lock em memória (ReentrantLock) envolve o ciclo de vida completo da transação do banco (commit do estoque).
     * 2. Imediatamente após o commit do estoque e liberação do lock, salva um registro na tabela 'notification' com status 'pending'.
     * 3. Dispara a tarefa assíncrona (@Async) no NotificationService, retornando imediatamente para que o cliente HTTP receba 200 OK sem aguardar os 2000ms do envio.
     *
     * @param productId identificador do produto
     * @param quantity quantidade desejada para compra
     * @param orderId identificador do pedido
     * @return PurchaseResult contendo o produto atualizado e a notificação registrada
     */
    public PurchaseResult purchaseProduct(String productId, int quantity, String orderId) {
        if (productId == null || productId.trim().isEmpty()) {
            throw new IllegalArgumentException("ID do produto não pode ser nulo ou vazio.");
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("A quantidade da compra deve ser maior que zero.");
        }

        String effectiveOrderId = (orderId != null && !orderId.trim().isEmpty()) ? orderId : UUID.randomUUID().toString();

        // 1. Obtém ou inicializa o lock reentrante com equidade (fair=true) para o produto específico
        ReentrantLock lock = productLocks.computeIfAbsent(productId, id -> new ReentrantLock(true));

        log.info("[THREAD-{}] Aguardando lock para produto: {}", Thread.currentThread().getName(), productId);
        lock.lock();
        Product savedProduct;
        try {
            log.info("[THREAD-{}] Lock adquirido para produto: {}. Iniciando transação.", Thread.currentThread().getName(), productId);

            savedProduct = transactionTemplate.execute(status -> {
                Product product = productRepository.findById(productId)
                        .orElseThrow(() -> new ProductNotFoundException("Produto não encontrado com id: " + productId));

                log.info("[THREAD-{}] Estoque atual do produto '{}': {}, Quantidade solicitada: {}",
                        Thread.currentThread().getName(), product.getName(), product.getStock(), quantity);

                if (product.getStock() < quantity) {
                    log.warn("[THREAD-{}] Falha na compra: estoque insuficiente para o produto '{}' (Disponível: {}, Solicitado: {})",
                            Thread.currentThread().getName(), productId, product.getStock(), quantity);
                    throw new InsufficientStockException("Estoque insuficiente para o produto " + productId +
                            ". Disponível: " + product.getStock() + ", Solicitado: " + quantity);
                }

                product.setStock(product.getStock() - quantity);
                Product persisted = productRepository.save(product);

                log.info("[THREAD-{}] Sucesso: Estoque do produto '{}' atualizado para {}",
                        Thread.currentThread().getName(), productId, persisted.getStock());

                return persisted;
            });
        } finally {
            lock.unlock();
            log.info("[THREAD-{}] Lock liberado para produto: {}", Thread.currentThread().getName(), productId);
        }

        // 2. Registra imediatamente a notificação com status 'pending'
        Notification notification = new Notification(effectiveOrderId, "pending");
        Notification savedNotification = notificationRepository.save(notification);

        log.info("[THREAD-{}] Notificação registrada com sucesso no BD [ID: {}, OrderID: {}, Status: 'pending'].",
                Thread.currentThread().getName(), savedNotification.getId(), savedNotification.getOrderId());

        // 3. Dispara processamento assíncrono em background (não bloqueia a thread principal)
        notificationService.sendNotificationAsync(savedNotification.getId());

        log.info("[THREAD-{}] Notificação despachada assincronamente. Retornando resposta imediata ao chamador.",
                Thread.currentThread().getName());

        return new PurchaseResult(savedProduct, savedNotification);
    }

    /**
     * Retorna a contagem de threads aguardando na fila pelo lock de um produto específico.
     */
    public int getQueueLengthForProduct(String productId) {
        ReentrantLock lock = productLocks.get(productId);
        return lock != null ? lock.getQueueLength() : 0;
    }
}
