package com.origem.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Pool de threads dedicado para tarefas assíncronas de notificação e mensageria.
     * Evita o uso do executor padrão não-limitado (SimpleAsyncTaskExecutor),
     * garantindo dimensionamento previsível de recursos e nomes claros de threads para observabilidade.
     */
    @Bean(name = "notificationTaskExecutor")
    public Executor notificationTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("async-notification-");
        executor.initialize();
        return executor;
    }
}
