package com.origem.ed.estrutura;

/**
 * Implementação manual de Fila Encadeada (FIFO - First In, First Out) construída do zero,
 * sem uso de Queue, LinkedList ou qualquer coleção do java.util.
 *
 * @param <T> Tipo dos elementos na fila.
 */
public class Fila<T> {

    private No<T> inicio;
    private No<T> fim;
    private int tamanho;

    public Fila() {
        this.inicio = null;
        this.fim = null;
        this.tamanho = 0;
    }

    /**
     * Insere um elemento no final da fila.
     * Complexidade: O(1).
     */
    public void enfileirar(T valor) {
        No<T> novoNo = new No<>(valor);
        if (estaVazia()) {
            this.inicio = novoNo;
            this.fim = novoNo;
        } else {
            this.fim.setProximo(novoNo);
            this.fim = novoNo;
        }
        this.tamanho++;
    }

    /**
     * Remove e retorna o elemento do início da fila.
     * Complexidade: O(1).
     */
    public T desenfileirar() {
        if (estaVazia()) {
            throw new IllegalStateException("A fila está vazia.");
        }
        T valor = this.inicio.getValor();
        this.inicio = this.inicio.getProximo();
        this.tamanho--;

        if (this.tamanho == 0) {
            this.fim = null;
        }

        return valor;
    }

    /**
     * Retorna o primeiro elemento da fila sem removê-lo.
     * Complexidade: O(1).
     */
    public T primeiro() {
        if (estaVazia()) {
            throw new IllegalStateException("A fila está vazia.");
        }
        return this.inicio.getValor();
    }

    /**
     * Informa se a fila está vazia.
     */
    public boolean estaVazia() {
        return this.tamanho == 0;
    }

    /**
     * Retorna a quantidade de elementos na fila.
     */
    public int tamanho() {
        return this.tamanho;
    }

    /**
     * Limpa a fila.
     */
    public void limpar() {
        this.inicio = null;
        this.fim = null;
        this.tamanho = 0;
    }
}

