package com.origem.ed.estrutura;

/**
 * Nó genérico utilizado em estruturas lineares encadeadas (Lista, Pilha, Fila).
 *
 * @param <T> Tipo do valor armazenado.
 */
public class No<T> {
    private T valor;
    private No<T> proximo;

    public No(T valor) {
        this.valor = valor;
        this.proximo = null;
    }

    public No(T valor, No<T> proximo) {
        this.valor = valor;
        this.proximo = proximo;
    }

    public T getValor() {
        return valor;
    }

    public void setValor(T valor) {
        this.valor = valor;
    }

    public No<T> getProximo() {
        return proximo;
    }

    public void setProximo(No<T> proximo) {
        this.proximo = proximo;
    }
}

