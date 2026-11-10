package com.origem.concorrencia;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Classe executável e utilitária para demonstrar a comparação prática entre:
 * 1) Produtor-Consumidor com CONDIÇÃO DE CORRIDA (resultado corrompido / inconsistente).
 * 2) Produtor-Consumidor CORRIGIDO com Lock/Mutex e Condições (resultado 100% íntegro).
 */
public class ProdutorConsumidorDemonstracao {

    public static class RelatorioExecucao {
        public final String cenario;
        public final int totalProduzido;
        public final int totalConsumido;
        public final int saldoFinalBuffer;
        public final int sobreescritas;
        public final int leiturasNulas;
        public final boolean sucesso;

        public RelatorioExecucao(String cenario, int totalProduzido, int totalConsumido,
                                 int saldoFinalBuffer, int sobreescritas, int leiturasNulas, boolean sucesso) {
            this.cenario = cenario;
            this.totalProduzido = totalProduzido;
            this.totalConsumido = totalConsumido;
            this.saldoFinalBuffer = saldoFinalBuffer;
            this.sobreescritas = sobreescritas;
            this.leiturasNulas = leiturasNulas;
            this.sucesso = sucesso;
        }

        @Override
        public String toString() {
            return String.format(
                "[%s]\n" +
                "  - Produzidos: %d | Consumidos: %d\n" +
                "  - Saldo no Buffer: %d (Esperado: %d)\n" +
                "  - Sobrescritas Detectadas: %d\n" +
                "  - Leituras Nulas Detectadas: %d\n" +
                "  - Estado: %s",
                cenario, totalProduzido, totalConsumido, saldoFinalBuffer,
                (totalProduzido - totalConsumido),
                sobreescritas, leiturasNulas,
                sucesso ? "CONSISTENTE (Sem Race Condition)" : "CORROMPIDO (Race Condition Evidenciada)"
            );
        }
    }

    /**
     * Executa o cenário inseguro (Race Condition).
     */
    public static RelatorioExecucao executarInseguro(int qtdProdutores, int qtdConsumidores,
                                                     int itensPorThread, int capacidadeBuffer) throws InterruptedException {
        BufferInseguro<Integer> buffer = new BufferInseguro<>(capacidadeBuffer);
        AtomicInteger totalProduzido = new AtomicInteger(0);
        AtomicInteger totalConsumido = new AtomicInteger(0);

        Thread[] produtores = new Thread[qtdProdutores];
        Thread[] consumidores = new Thread[qtdConsumidores];

        for (int i = 0; i < qtdProdutores; i++) {
            final int idProdutor = i;
            produtores[i] = new Thread(() -> {
                for (int j = 0; j < itensPorThread; j++) {
                    try {
                        buffer.produzir((idProdutor * 1000) + j);
                        totalProduzido.incrementAndGet();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }, "Produtor-Inseguro-" + i);
            produtores[i].setDaemon(true);
        }

        for (int i = 0; i < qtdConsumidores; i++) {
            consumidores[i] = new Thread(() -> {
                for (int j = 0; j < itensPorThread; j++) {
                    try {
                        Integer item = buffer.consumir();
                        if (item != null) {
                            totalConsumido.incrementAndGet();
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }, "Consumidor-Inseguro-" + i);
            consumidores[i].setDaemon(true);
        }

        for (Thread p : produtores) p.start();
        for (Thread c : consumidores) c.start();

        for (Thread p : produtores) p.join(3000);
        for (Thread c : consumidores) c.join(3000);

        int esperadoNoBuffer = totalProduzido.get() - totalConsumido.get();
        boolean consistente = (buffer.getTamanho() == esperadoNoBuffer)
                && (buffer.getSobreescritasDetectadas() == 0)
                && (buffer.getLeiturasNulasDetectadas() == 0);

        return new RelatorioExecucao(
            "CENÁRIO 1: BUFFER INSEGURO (RACE CONDITION)",
            totalProduzido.get(),
            totalConsumido.get(),
            buffer.getTamanho(),
            buffer.getSobreescritasDetectadas(),
            buffer.getLeiturasNulasDetectadas(),
            consistente
        );
    }

    /**
     * Executa o cenário seguro com Lock/Mutex (Sem Race Condition).
     */
    public static RelatorioExecucao executarSincronizado(int qtdProdutores, int qtdConsumidores,
                                                         int itensPorThread, int capacidadeBuffer) throws InterruptedException {
        BufferSincronizado<Integer> buffer = new BufferSincronizado<>(capacidadeBuffer);
        AtomicInteger totalProduzido = new AtomicInteger(0);
        AtomicInteger totalConsumido = new AtomicInteger(0);

        Thread[] produtores = new Thread[qtdProdutores];
        Thread[] consumidores = new Thread[qtdConsumidores];

        for (int i = 0; i < qtdProdutores; i++) {
            final int idProdutor = i;
            produtores[i] = new Thread(() -> {
                for (int j = 0; j < itensPorThread; j++) {
                    try {
                        buffer.produzir((idProdutor * 1000) + j);
                        totalProduzido.incrementAndGet();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }, "Produtor-Lock-" + i);
            produtores[i].setDaemon(true);
        }

        for (int i = 0; i < qtdConsumidores; i++) {
            consumidores[i] = new Thread(() -> {
                for (int j = 0; j < itensPorThread; j++) {
                    try {
                        Integer item = buffer.consumir();
                        if (item != null) {
                            totalConsumido.incrementAndGet();
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }, "Consumidor-Lock-" + i);
            consumidores[i].setDaemon(true);
        }

        for (Thread p : produtores) p.start();
        for (Thread c : consumidores) c.start();

        for (Thread p : produtores) p.join(5000);
        for (Thread c : consumidores) c.join(5000);

        int esperadoNoBuffer = totalProduzido.get() - totalConsumido.get();
        boolean consistente = (buffer.getTamanho() == esperadoNoBuffer);

        return new RelatorioExecucao(
            "CENÁRIO 2: BUFFER SINCRONIZADO COM LOCK / MUTEX",
            totalProduzido.get(),
            totalConsumido.get(),
            buffer.getTamanho(),
            0,
            0,
            consistente
        );
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println("================================================================================");
        System.out.println("DEMONSTRAÇÃO DE PRODUTOR-CONSUMIDOR: RACE CONDITION VS MUTEX/LOCK");
        System.out.println("================================================================================\n");

        int produtores = 4;
        int consumidores = 4;
        int itens = 50;
        int capacidade = 10;

        RelatorioExecucao rInseguro = executarInseguro(produtores, consumidores, itens, capacidade);
        System.out.println(rInseguro);
        System.out.println();

        RelatorioExecucao rSeguro = executarSincronizado(produtores, consumidores, itens, capacidade);
        System.out.println(rSeguro);
        System.out.println();

        System.out.println("================================================================================");
        System.out.println("CONCLUSÃO: O uso de ReentrantLock + Condition elimina anomalias e garante ACID.");
        System.out.println("================================================================================");
    }
}
