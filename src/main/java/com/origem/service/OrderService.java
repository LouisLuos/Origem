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

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final ProductRepository productRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final TransactionTemplate transactionTemplate;

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
     * Realiza a compra de um produto utilizando EXCLUSIVAMENTE controle de concorrência a nível
     * de banco de dados (Lock Pessimista: SELECT ... FOR UPDATE).
     *
     * Fluxo da Operação:
     * 1. Inicia transação no PostgreSQL e adquire bloqueio exclusivo de linha (PESSIMISTIC_WRITE).
     *    Múltiplas requisições simultâneas para o mesmo produto são serializadas na fila do banco.
     * 2. Valida o estoque atual sob o bloqueio: se menor que a quantidade, aborta com InsufficientStockException.
     * 3. Decrementa o estoque, persiste a alteração e comita a transação liberando o bloqueio.
     * 4. Registra a tarefa de background na tabela 'notification' com status inicial 'pending'.
     * 5. Despacha a execução assíncrona (@Async) sem bloquear ou atrasar a resposta ao usuário.
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

        log.info("[THREAD-{}] Disputando compra no BD para produto: {} (Quantidade: {})",
                Thread.currentThread().getName(), productId, quantity);

        // 1. Execução transacional com Lock Pessimista exclusivo a nível de banco de dados
        Product savedProduct = transactionTemplate.execute(status -> {
            Product product = productRepository.findByIdForUpdate(productId)
                    .orElseThrow(() -> new ProductNotFoundException("Produto não encontrado com id: " + productId));

            log.info("[THREAD-{}] [DB-LOCK ACQUIRED] Produto '{}': Estoque disponível no BD = {}, Solicitado = {}",
                    Thread.currentThread().getName(), product.getName(), product.getStock(), quantity);

            if (product.getStock() < quantity) {
                log.warn("[THREAD-{}] [ESTOQUE INSUFICIENTE] Produto '{}': Disponível = {}, Solicitado = {}. Abortando.",
                        Thread.currentThread().getName(), productId, product.getStock(), quantity);
                throw new InsufficientStockException("Estoque insuficiente para o produto " + productId +
                        ". Disponível: " + product.getStock() + ", Solicitado: " + quantity);
            }

            product.setStock(product.getStock() - quantity);
            Product persisted = productRepository.save(product);

            log.info("[THREAD-{}] [DB-LOCK COMMIT] Produto '{}': Novo estoque persistido = {}",
                    Thread.currentThread().getName(), productId, persisted.getStock());

            return persisted;
        });

        // 2. Persiste imediatamente a tarefa assíncrona na fila (tabela 'notification') com status inicial 'pending'
        Notification notification = new Notification(effectiveOrderId, "pending");
        Notification savedNotification = notificationRepository.save(notification);

        log.info("[THREAD-{}] Notificação gravada na fila do BD [ID: {}, OrderID: {}, Status: 'pending'].",
                Thread.currentThread().getName(), savedNotification.getId(), savedNotification.getOrderId());

        // 3. Dispara processamento em background desacoplado (sem bloquear o retorno da requisição HTTP)
        notificationService.sendNotificationAsync(savedNotification.getId());

        log.info("[THREAD-{}] Tarefa despachada assincronamente. Liberando resposta imediata ao cliente.",
                Thread.currentThread().getName());

        return new PurchaseResult(savedProduct, savedNotification);
    }
}
