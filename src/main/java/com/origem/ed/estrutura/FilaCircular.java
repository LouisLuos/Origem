package com.origem.ed.estrutura;

/**
 * Implementação manual de Fila Circular baseada em vetor de tamanho fixo,
 * utilizando aritmética modular para o avanço dos ponteiros de início e fim.
 * Desenvolvida do zero sem coleções prontas.
 *
 * @param <T> Tipo dos elementos contidos na fila.
 */
public class FilaCircular<T> {

    private final Object[] elementos;
    private final int capacidade;
    private int inicio;
    private int fim;
    private int tamanho;

    public FilaCircular(int capacidade) {
        if (capacidade <= 0) {
            throw new IllegalArgumentException("A capacidade deve ser maior que zero: " + capacidade);
        }
        this.capacidade = capacidade;
        this.elementos = new Object[capacidade];
        this.inicio = 0;
        this.fim = 0;
        this.tamanho = 0;
    }

    /**
     * Enfileira um novo elemento na posição de fim da fila circular.
     * Complexidade: O(1).
     */
    public void enfileirar(T valor) {
        if (estaCheia()) {
            throw new IllegalStateException("A fila circular está cheia (capacidade máxima: " + capacidade + ").");
        }
        this.elementos[this.fim] = valor;
        this.fim = (this.fim + 1) % this.capacidade;
        this.tamanho++;
    }

    /**
     * Desenfileira o elemento posicionado no início da fila circular.
     * Complexidade: O(1).
     */
    @SuppressWarnings("unchecked")
    public T desenfileirar() {
        if (estaVazia()) {
            throw new IllegalStateException("A fila circular está vazia.");
        }
        T valor = (T) this.elementos[this.inicio];
        this.elementos[this.inicio] = null; // Evita vazamento de memória (memory leak)
        this.inicio = (this.inicio + 1) % this.capacidade;
        this.tamanho--;
        return valor;
    }

    /**
     * Retorna o elemento da frente da fila circular sem removê-lo.
     * Complexidade: O(1).
     */
    @SuppressWarnings("unchecked")
    public T primeiro() {
        if (estaVazia()) {
            throw new IllegalStateException("A fila circular está vazia.");
        }
        return (T) this.elementos[this.inicio];
    }

    /**
     * Verifica se a fila circular atingiu a sua capacidade máxima.
     */
    public boolean estaCheia() {
        return this.tamanho == this.capacidade;
    }

    /**
     * Verifica se a fila circular está vazia.
     */
    public boolean estaVazia() {
        return this.tamanho == 0;
    }

    /**
     * Retorna o número de elementos atualmente armazenados na fila.
     */
    public int tamanho() {
        return this.tamanho;
    }

    /**
     * Retorna a capacidade total alocada para a fila circular.
     */
    public int capacidade() {
        return this.capacidade;
    }

    /**
     * Limpa a fila circular, resetando os ponteiros e liberando referências.
     */
    public void limpar() {
        for (int i = 0; i < capacidade; i++) {
            this.elementos[i] = null;
        }
        this.inicio = 0;
        this.fim = 0;
        this.tamanho = 0;
    }
}

