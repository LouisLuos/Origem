package com.origem.concorrencia;

import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Buffer compartilhado SEGURO com sincronização baseada em Lock/Mutex explícito
 * ({@link ReentrantLock}) e Variáveis de Condição ({@link Condition}).
 *
 * <p>Esta implementação resolve completamente os problemas de concorrência observados no
 * {@link BufferInseguro}:</p>
 * <ul>
 *   <li><b>Exclusão Mútua:</b> Apenas uma thread executa a seção crítica por vez (via lock).</li>
 *   <li><b>Espera Eficiente (sem busy-wait):</b> Produtores aguardam em {@code naoCheio.await()}
 *       quando o buffer atinge a capacidade máxima, sem queimar CPU.</li>
 *   <li><b>Consumidores Sincronizados:</b> Consumidores aguardam em {@code naoVazio.await()}
 *       quando o buffer está vazio.</li>
 *   <li><b>Sinalização Precisa:</b> Cada inserção acorda um consumidor adormecido via {@code naoVazio.signal()},
 *       e cada remoção acorda um produtor via {@code naoCheio.signal()}.</li>
 *   <li><b>Integridade Total:</b> Elimina perda de atualizações, sobrescrita e leituras incorretas.</li>
 * </ul>
 *
 * @param <T> Tipo dos itens transitados.
 */
public class BufferSincronizado<T> implements BufferCompartilhado<T> {

    private final Object[] itens;
    private final int capacidade;
    private int inicio;
    private int fim;
    private int contador;

    // Primitivas de sincronização (Lock / Mutex + Variáveis de Condição)
    private final ReentrantLock lock;
    private final Condition naoCheio;
    private final Condition naoVazio;

    public BufferSincronizado(int capacidade) {
        if (capacidade <= 0) {
            throw new IllegalArgumentException("Capacidade deve ser maior que zero: " + capacidade);
        }
        this.capacidade = capacidade;
        this.itens = new Object[capacidade];
        this.inicio = 0;
        this.fim = 0;
        this.contador = 0;

        // Mutex com justiça (fair = true) para garantir ordem de atendimento e evitar starvation
        this.lock = new ReentrantLock(true);
        this.naoCheio = this.lock.newCondition();
        this.naoVazio = this.lock.newCondition();
    }

    @Override
    public void produzir(T item) throws InterruptedException {
        lock.lock();
        try {
            // Enquanto o buffer estiver na capacidade máxima, a thread produtora dorme liberando o lock
            while (contador == capacidade) {
                naoCheio.await();
            }

            itens[fim] = item;
            fim = (fim + 1) % capacidade;
            contador++;

            // Sinaliza para as threads consumidoras que um novo item está disponível
            naoVazio.signal();
        } finally {
            lock.unlock();
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public T consumir() throws InterruptedException {
        lock.lock();
        try {
            // Enquanto o buffer estiver vazio, a thread consumidora dorme liberando o lock
            while (contador == 0) {
                naoVazio.await();
            }

            T item = (T) itens[inicio];
            itens[inicio] = null; // Evita vazamento de memória
            inicio = (inicio + 1) % capacidade;
            contador--;

            // Sinaliza para as threads produtoras que abriu espaço no buffer
            naoCheio.signal();

            return item;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public int getTamanho() {
        lock.lock();
        try {
            return contador;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public int getCapacidade() {
        return capacidade;
    }
}

