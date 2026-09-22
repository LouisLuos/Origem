package com.origem.service;

import com.origem.exception.InsufficientStockException;
import com.origem.exception.ProductNotFoundException;
import com.origem.model.Product;
import com.origem.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final ProductRepository productRepository;
    private final TransactionTemplate transactionTemplate;

    // Mapa de locks por ID do produto: garante que requisições para o mesmo produto entrem em fila,
    // enquanto requisições para produtos distintos executam em paralelo.
    // O fair lock (true) garante política FIFO estrita na disputa pelo lock do mesmo produto.
    private final ConcurrentHashMap<String, ReentrantLock> productLocks = new ConcurrentHashMap<>();

    public OrderService(ProductRepository productRepository, TransactionTemplate transactionTemplate) {
        this.productRepository = productRepository;
        this.transactionTemplate = transactionTemplate;
    }

    /**
     * Realiza a compra de um produto de forma concorrente e segura.
     *
     * Padrão Arquitetural Crítico:
     * O lock em memória DEVE envolver o ciclo de vida completo da transação do banco (início, execução e commit).
     * Caso contrário, se o lock for liberado antes do commit da transação, outra thread concorrente
     * pode ler o estoque desatualizado (stale/dirty read sob READ COMMITTED) gerando overselling.
     * Por isso, utilizamos TransactionTemplate explicitamente dentro do bloco crítico protegido por lock.lock() / unlock().
     *
     * @param productId identificador do produto
     * @param quantity quantidade desejada para compra
     * @return o produto atualizado com o novo estoque persistido
     */
    public Product purchaseProduct(String productId, int quantity) {
        if (productId == null || productId.trim().isEmpty()) {
            throw new IllegalArgumentException("ID do produto não pode ser nulo ou vazio.");
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("A quantidade da compra deve ser maior que zero.");
        }

        // Obtém ou inicializa o lock reentrante com equidade (fair=true) para o produto específico
        ReentrantLock lock = productLocks.computeIfAbsent(productId, id -> new ReentrantLock(true));

        log.info("[THREAD-{}] Aguardando lock para produto: {}", Thread.currentThread().getName(), productId);
        lock.lock();
        try {
            log.info("[THREAD-{}] Lock adquirido para produto: {}. Iniciando transação.", Thread.currentThread().getName(), productId);

            return transactionTemplate.execute(status -> {
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
                Product savedProduct = productRepository.save(product);

                log.info("[THREAD-{}] Sucesso: Estoque do produto '{}' atualizado para {}",
                        Thread.currentThread().getName(), productId, savedProduct.getStock());

                return savedProduct;
            });
        } finally {
            lock.unlock();
            log.info("[THREAD-{}] Lock liberado para produto: {}", Thread.currentThread().getName(), productId);
        }
    }

    /**
     * Retorna a contagem de threads aguardando na fila pelo lock de um produto específico (para fins de telemetria/teste).
     */
    public int getQueueLengthForProduct(String productId) {
        ReentrantLock lock = productLocks.get(productId);
        return lock != null ? lock.getQueueLength() : 0;
    }
}
