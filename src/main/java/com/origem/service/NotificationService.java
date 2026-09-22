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

    @Value("${app.notification.retry-interval-ms:500}")
    private long retryIntervalMs;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    /**
     * Processa a notificação de forma 100% assíncrona, desacoplada da thread HTTP principal.
     *
     * Regras (Requisitos 3 e 4):
     * 1. Executa no pool de threads dedicado ("notificationTaskExecutor").
     * 2. Simula latência de processamento em segundo plano sem travar o checkout.
     * 3. Política de resiliência: até 3 tentativas com INTERVALO FIXO entre elas (sem backoff progressivo).
     * 4. Transita o status de 'pending' -> 'sent' em caso de sucesso.
     * 5. Transita o status para 'failed' caso todas as 3 tentativas falhem, mantendo o registro permanentemente salvo.
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
            log.info("[ASYNC-NOTIF] [THREAD: {}] Tentativa {}/{} de processamento da tarefa (Order ID: {})",
                    Thread.currentThread().getName(), currentAttempt, maxRetries, notification.getOrderId());

            try {
                // Simulação de processamento de background (ex: envio de e-mail/notificação)
                if (simulatedDelayMs > 0) {
                    Thread.sleep(simulatedDelayMs);
                }

                // Simulação determinística de falha para cenários de resiliência:
                if (notification.getOrderId() != null &&
                        (notification.getOrderId().toUpperCase().contains("FAIL") ||
                         notification.getOrderId().contains("simulate-failure"))) {
                    throw new RuntimeException("Falha simulada no processamento externo da tarefa.");
                }

                // Tarefa executada com sucesso
                success = true;
                log.info("[ASYNC-NOTIF] [THREAD: {}] Tarefa concluída com sucesso na tentativa {}.",
                        Thread.currentThread().getName(), currentAttempt);

            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.error("[ASYNC-NOTIF] [THREAD: {}] Thread interrompida durante o processamento da notificação ID: {}",
                        Thread.currentThread().getName(), notificationId);
                break;
            } catch (Exception ex) {
                log.warn("[ASYNC-NOTIF] [THREAD: {}] Falha na tentativa {}/{}: {}.",
                        Thread.currentThread().getName(), currentAttempt, maxRetries, ex.getMessage());

                if (currentAttempt < maxRetries) {
                    try {
                        log.info("[ASYNC-NOTIF] [THREAD: {}] Aguardando intervalo fixo de {}ms antes da próxima tentativa (sem backoff progressivo)...",
                                Thread.currentThread().getName(), retryIntervalMs);
                        Thread.sleep(retryIntervalMs); // Intervalo estritamente fixo entre tentativas
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

    public void setRetryIntervalMs(long retryIntervalMs) {
        this.retryIntervalMs = retryIntervalMs;
    }
}
