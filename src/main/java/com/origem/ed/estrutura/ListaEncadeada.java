package com.origem.ed.estrutura;

/**
 * Implementação manual de Lista Simplesmente Encadeada construída do zero,
 * sem utilização de nenhuma coleção pronta da biblioteca padrão da linguagem.
 *
 * @param <T> Tipo dos elementos contidos na lista.
 */
public class ListaEncadeada<T> {

    private No<T> inicio;
    private No<T> fim;
    private int tamanho;

    public ListaEncadeada() {
        this.inicio = null;
        this.fim = null;
        this.tamanho = 0;
    }

    /**
     * Insere um novo elemento no final da lista encadeada.
     * Complexidade: O(1) devido ao ponteiro de fim.
     */
    public void inserir(T valor) {
        inserirFim(valor);
    }

    /**
     * Insere um elemento no início da lista encadeada.
     * Complexidade: O(1).
     */
    public void inserirInicio(T valor) {
        No<T> novoNo = new No<>(valor);
        if (estaVazia()) {
            this.inicio = novoNo;
            this.fim = novoNo;
        } else {
            novoNo.setProximo(this.inicio);
            this.inicio = novoNo;
        }
        this.tamanho++;
    }

    /**
     * Insere um elemento no fim da lista encadeada.
     * Complexidade: O(1).
     */
    public void inserirFim(T valor) {
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
     * Insere um elemento em uma posição específica pelo índice (0-based).
     * Complexidade: O(n).
     */
    public void inserirNaPosicao(int indice, T valor) {
        if (indice < 0 || indice > tamanho) {
            throw new IndexOutOfBoundsException("Índice fora dos limites: " + indice);
        }

        if (indice == 0) {
            inserirInicio(valor);
            return;
        }

        if (indice == tamanho) {
            inserirFim(valor);
            return;
        }

        No<T> anterior = obterNo(indice - 1);
        No<T> novoNo = new No<>(valor, anterior.getProximo());
        anterior.setProximo(novoNo);
        this.tamanho++;
    }

    /**
     * Remove o primeiro elemento da lista encadeada.
     * Complexidade: O(1).
     */
    public T removerInicio() {
        if (estaVazia()) {
            throw new IllegalStateException("A lista está vazia.");
        }

        T valorRemovido = this.inicio.getValor();
        this.inicio = this.inicio.getProximo();
        this.tamanho--;

        if (this.tamanho == 0) {
            this.fim = null;
        }

        return valorRemovido;
    }

    /**
     * Remove o último elemento da lista encadeada.
     * Complexidade: O(n).
     */
    public T removerFim() {
        if (estaVazia()) {
            throw new IllegalStateException("A lista está vazia.");
        }

        if (this.tamanho == 1) {
            return removerInicio();
        }

        No<T> penultimo = obterNo(this.tamanho - 2);
        T valorRemovido = this.fim.getValor();
        penultimo.setProximo(null);
        this.fim = penultimo;
        this.tamanho--;

        return valorRemovido;
    }

    /**
     * Remove a primeira ocorrência do valor especificado.
     * Complexidade: O(n).
     */
    public boolean remover(T valor) {
        if (estaVazia()) {
            return false;
        }

        if (iguais(this.inicio.getValor(), valor)) {
            removerInicio();
            return true;
        }

        No<T> atual = this.inicio;
        while (atual.getProximo() != null) {
            if (iguais(atual.getProximo().getValor(), valor)) {
                if (atual.getProximo() == this.fim) {
                    this.fim = atual;
                }
                atual.setProximo(atual.getProximo().getProximo());
                this.tamanho--;
                return true;
            }
            atual = atual.getProximo();
        }

        return false;
    }

    /**
     * Remove o elemento no índice especificado.
     * Complexidade: O(n).
     */
    public T removerDaPosicao(int indice) {
        validarIndice(indice);

        if (indice == 0) {
            return removerInicio();
        }

        No<T> anterior = obterNo(indice - 1);
        No<T> alvo = anterior.getProximo();
        anterior.setProximo(alvo.getProximo());

        if (indice == tamanho - 1) {
            this.fim = anterior;
        }

        this.tamanho--;
        return alvo.getValor();
    }

    /**
     * Obtém o valor do elemento no índice informado.
     * Complexidade: O(n).
     */
    public T obter(int indice) {
        validarIndice(indice);
        return obterNo(indice).getValor();
    }

    /**
     * Verifica se o elemento existe na lista.
     * Complexidade: O(n).
     */
    public boolean contem(T valor) {
        No<T> atual = this.inicio;
        while (atual != null) {
            if (iguais(atual.getValor(), valor)) {
                return true;
            }
            atual = atual.getProximo();
        }
        return false;
    }

    /**
     * Retorna a quantidade de nós presentes na lista.
     */
    public int tamanho() {
        return this.tamanho;
    }

    /**
     * Informa se a lista está vazia.
     */
    public boolean estaVazia() {
        return this.tamanho == 0;
    }

    /**
     * Limpa todos os elementos da lista.
     */
    public void limpar() {
        this.inicio = null;
        this.fim = null;
        this.tamanho = 0;
    }

    /**
     * Converte os elementos da lista para um vetor manual fornecido.
     */
    @SuppressWarnings("unchecked")
    public T[] paraArray(T[] destino) {
        if (destino.length < this.tamanho) {
            destino = (T[]) java.lang.reflect.Array.newInstance(destino.getClass().getComponentType(), this.tamanho);
        }
        No<T> atual = this.inicio;
        int i = 0;
        while (atual != null) {
            destino[i++] = atual.getValor();
            atual = atual.getProximo();
        }
        return destino;
    }

    private No<T> obterNo(int indice) {
        No<T> atual = this.inicio;
        for (int i = 0; i < indice; i++) {
            atual = atual.getProximo();
        }
        return atual;
    }

    private void validarIndice(int indice) {
        if (indice < 0 || indice >= tamanho) {
            throw new IndexOutOfBoundsException("Índice fora dos limites: " + indice + " (tamanho atual: " + tamanho + ")");
        }
    }

    private boolean iguais(T a, T b) {
        if (a == null) {
            return b == null;
        }
        return a.equals(b);
    }
}

