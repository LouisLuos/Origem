package com.origem.ed.estrutura;

/**
 * Implementação manual de Pilha (LIFO - Last In, First Out) desenvolvida do zero,
 * sem uso de Stack, Deque ou qualquer classe de coleções padrão.
 *
 * @param <T> Tipo dos elementos contidos na pilha.
 */
public class Pilha<T> {

    private No<T> topo;
    private int tamanho;

    public Pilha() {
        this.topo = null;
        this.tamanho = 0;
    }

    /**
     * Empilha um novo elemento no topo da pilha.
     * Complexidade: O(1).
     */
    public void push(T valor) {
        empilhar(valor);
    }

    public void empilhar(T valor) {
        No<T> novoNo = new No<>(valor);
        novoNo.setProximo(this.topo);
        this.topo = novoNo;
        this.tamanho++;
    }

    /**
     * Desempilha e retorna o elemento do topo da pilha.
     * Complexidade: O(1).
     */
    public T pop() {
        return desempilhar();
    }

    public T desempilhar() {
        if (estaVazia()) {
            throw new IllegalStateException("A pilha está vazia.");
        }
        T valor = this.topo.getValor();
        this.topo = this.topo.getProximo();
        this.tamanho--;
        return valor;
    }

    /**
     * Retorna o elemento do topo sem removê-lo.
     * Complexidade: O(1).
     */
    public T peek() {
        return topo();
    }

    public T topo() {
        if (estaVazia()) {
            throw new IllegalStateException("A pilha está vazia.");
        }
        return this.topo.getValor();
    }

    /**
     * Verifica se a pilha está vazia.
     */
    public boolean estaVazia() {
        return this.tamanho == 0;
    }

    /**
     * Retorna o número de elementos atualmente na pilha.
     */
    public int tamanho() {
        return this.tamanho;
    }

    /**
     * Limpa a pilha.
     */
    public void limpar() {
        this.topo = null;
        this.tamanho = 0;
    }
}

