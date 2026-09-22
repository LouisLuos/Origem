package com.origem.service;

import com.origem.model.Notification;
import com.origem.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;

    @Value("${app.notification.delay-ms:2000}")
    private long simulatedDelayMs;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    /**
     * Processa a notificação de forma 100% assíncrona, desacoplada da thread HTTP principal.
     *
     * Regras:
     * 1. Executa no pool de threads dedicado ("notificationTaskExecutor").
     * 2. Simula latência de rede/I/O (padrão 2000ms para envio de e-mail/push/SMS).
     * 3. Possui política de até 3 retentativas automáticas em caso de falha transitória de comunicação.
     * 4. Transita o status de 'pending' -> 'sent' em caso de sucesso.
     * 5. Transita o status para 'failed' se esgotar as 3 tentativas.
     *
     * @param notificationId ID do registro de notificação persistido previamente como 'pending'
     */
    @Async("notificationTaskExecutor")
    public void sendNotificationAsync(String notificationId) {
        log.info("[ASYNC-NOTIF] [THREAD: {}] Início do processamento assíncrono para notificação ID: {}",
                Thread.currentThread().getName(), notificationId);

        Optional<Notification> optionalNotification = notificationRepository.findById(notificationId);
        if (optionalNotification.isEmpty()) {
            log.error("[ASYNC-NOTIF] [THREAD: {}] Registro de notificação não encontrado: {}",
                    Thread.currentThread().getName(), notificationId);
            return;
        }

        Notification notification = optionalNotification.get();
        int maxRetries = 3;
        int currentAttempt = 0;
        boolean success = false;

        while (currentAttempt < maxRetries && !success) {
            currentAttempt++;
            log.info("[ASYNC-NOTIF] [THREAD: {}] Tentativa {}/{} de envio da notificação (Order ID: {})",
                    Thread.currentThread().getName(), currentAttempt, maxRetries, notification.getOrderId());

            try {
                // Simulação de latência de rede (ex: gateway de envio de e-mail / Webhook)
                if (simulatedDelayMs > 0) {
                    Thread.sleep(simulatedDelayMs);
                }

                // Simulação determinística de falha para testes de resiliência:
                // Se o orderId contiver 'FAIL' ou 'simulate-failure', simula erro no gateway
                if (notification.getOrderId() != null &&
                        (notification.getOrderId().toUpperCase().contains("FAIL") ||
                         notification.getOrderId().contains("simulate-failure"))) {
                    throw new RuntimeException("Falha simulada no gateway de mensageria externa.");
                }

                // Se chegou aqui, o envio foi bem-sucedido
                success = true;
                log.info("[ASYNC-NOTIF] [THREAD: {}] Mensagem despachada com sucesso pelo gateway na tentativa {}.",
                        Thread.currentThread().getName(), currentAttempt);

            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.error("[ASYNC-NOTIF] [THREAD: {}] Thread interrompida durante o envio da notificação ID: {}",
                        Thread.currentThread().getName(), notificationId);
                break;
            } catch (Exception ex) {
                log.warn("[ASYNC-NOTIF] [THREAD: {}] Falha na tentativa {}/{}: {}.",
                        Thread.currentThread().getName(), currentAttempt, maxRetries, ex.getMessage());

                if (currentAttempt < maxRetries) {
                    try {
                        log.info("[ASYNC-NOTIF] [THREAD: {}] Aguardando backoff antes da próxima tentativa...",
                                Thread.currentThread().getName());
                        Thread.sleep(500); // Intervalo de recuo (backoff)
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }

        // Atualização atômica do status final na base de dados
        if (success) {
            notification.setStatus("sent");
            notificationRepository.save(notification);
            log.info("[ASYNC-NOTIF] [THREAD: {}] SUCESSO: Notificação ID: {} atualizada para status 'sent' na base de dados.",
                    Thread.currentThread().getName(), notificationId);
        } else {
            notification.setStatus("failed");
            notificationRepository.save(notification);
            log.error("[ASYNC-NOTIF] [THREAD: {}] ERRO: Notificação ID: {} esgotou todas as {} tentativas. Atualizada para status 'failed'.",
                    Thread.currentThread().getName(), notificationId, maxRetries);
        }
    }

    public void setSimulatedDelayMs(long simulatedDelayMs) {
        this.simulatedDelayMs = simulatedDelayMs;
    }
}
