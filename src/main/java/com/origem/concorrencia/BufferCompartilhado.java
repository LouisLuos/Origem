package com.origem.concorrencia;

/**
 * Interface comum para buffers compartilhados entre threads produtoras e consumidoras.
 *
 * @param <T> Tipo dos itens transitados no buffer.
 */
public interface BufferCompartilhado<T> {

    /**
     * Insere um item no buffer.
     *
     * @param item Item a ser produzido.
     * @throws InterruptedException se a thread for interrompida durante a espera.
     */
    void produzir(T item) throws InterruptedException;

    /**
     * Retira e retorna um item do buffer.
     *
     * @return Item consumido.
     * @throws InterruptedException se a thread for interrompida durante a espera.
     */
    T consumir() throws InterruptedException;

    /**
     * Retorna a quantidade de itens atualmente no buffer.
     */
    int getTamanho();

    /**
     * Retorna a capacidade máxima do buffer.
     */
    int getCapacidade();
}

