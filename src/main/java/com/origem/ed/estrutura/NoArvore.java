package com.origem.ed.estrutura;

/**
 * Nó para Árvore Binária de Busca.
 *
 * @param <T> Tipo comparável armazenado.
 */
public class NoArvore<T extends Comparable<T>> {
    private T valor;
    private NoArvore<T> esquerda;
    private NoArvore<T> direita;

    public NoArvore(T valor) {
        this.valor = valor;
        this.esquerda = null;
        this.direita = null;
    }

    public T getValor() {
        return valor;
    }

    public void setValor(T valor) {
        this.valor = valor;
    }

    public NoArvore<T> getEsquerda() {
        return esquerda;
    }

    public void setEsquerda(NoArvore<T> esquerda) {
        this.esquerda = esquerda;
    }

    public NoArvore<T> getDireita() {
        return direita;
    }

    public void setDireita(NoArvore<T> direita) {
        this.direita = direita;
    }
}

