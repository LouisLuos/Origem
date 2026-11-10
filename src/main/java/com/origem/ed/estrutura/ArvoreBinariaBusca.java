package com.origem.ed.estrutura;

/**
 * Implementação manual de Árvore Binária de Busca (BST - Binary Search Tree)
 * desenvolvida do zero, sem uso de coleções prontas.
 *
 * @param <T> Tipo dos elementos contidos na árvore, devendo implementar {@link Comparable}.
 */
public class ArvoreBinariaBusca<T extends Comparable<T>> {

    private NoArvore<T> raiz;
    private int tamanho;

    public ArvoreBinariaBusca() {
        this.raiz = null;
        this.tamanho = 0;
    }

    /**
     * Insere um novo elemento na árvore binária de busca.
     * Complexidade média: O(log n). Pior caso: O(n).
     */
    public void inserir(T valor) {
        if (valor == null) {
            throw new IllegalArgumentException("Valor não pode ser nulo.");
        }
        this.raiz = inserirRecursivo(this.raiz, valor);
    }

    private NoArvore<T> inserirRecursivo(NoArvore<T> noAtual, T valor) {
        if (noAtual == null) {
            this.tamanho++;
            return new NoArvore<>(valor);
        }

        int comparacao = valor.compareTo(noAtual.getValor());
        if (comparacao < 0) {
            noAtual.setEsquerda(inserirRecursivo(noAtual.getEsquerda(), valor));
        } else if (comparacao > 0) {
            noAtual.setDireita(inserirRecursivo(noAtual.getDireita(), valor));
        }
        // Se já existe (comparacao == 0), mantém sem duplicar

        return noAtual;
    }

    /**
     * Busca se um elemento está presente na árvore.
     * Complexidade média: O(log n). Pior caso: O(n).
     */
    public boolean buscar(T valor) {
        if (valor == null) {
            return false;
        }
        return buscarRecursivo(this.raiz, valor);
    }

    private boolean buscarRecursivo(NoArvore<T> noAtual, T valor) {
        if (noAtual == null) {
            return false;
        }

        int comparacao = valor.compareTo(noAtual.getValor());
        if (comparacao == 0) {
            return true;
        } else if (comparacao < 0) {
            return buscarRecursivo(noAtual.getEsquerda(), valor);
        } else {
            return buscarRecursivo(noAtual.getDireita(), valor);
        }
    }

    /**
     * Remove um elemento da árvore binária de busca mantendo suas propriedades.
     * Complexidade média: O(log n). Pior caso: O(n).
     */
    public boolean remover(T valor) {
        if (valor == null || estaVazia()) {
            return false;
        }
        int tamanhoAnterior = this.tamanho;
        this.raiz = removerRecursivo(this.raiz, valor);
        return this.tamanho < tamanhoAnterior;
    }

    private NoArvore<T> removerRecursivo(NoArvore<T> noAtual, T valor) {
        if (noAtual == null) {
            return null;
        }

        int comparacao = valor.compareTo(noAtual.getValor());
        if (comparacao < 0) {
            noAtual.setEsquerda(removerRecursivo(noAtual.getEsquerda(), valor));
        } else if (comparacao > 0) {
            noAtual.setDireita(removerRecursivo(noAtual.getDireita(), valor));
        } else {
            // Caso encontrado: nó a ser removido
            this.tamanho--;

            // Caso 1: Nó folha (sem filhos)
            if (noAtual.getEsquerda() == null && noAtual.getDireita() == null) {
                return null;
            }

            // Caso 2: Nó com apenas um filho
            if (noAtual.getEsquerda() == null) {
                return noAtual.getDireita();
            }
            if (noAtual.getDireita() == null) {
                return noAtual.getEsquerda();
            }

            // Caso 3: Nó com dois filhos
            // Localiza o menor valor da subárvore direita (sucessor em-ordem)
            T menorValor = encontrarMenorValor(noAtual.getDireita());
            noAtual.setValor(menorValor);
            // Incrementa temporariamente porque a remoção do sucessor irá decrementar tamanho novamente
            this.tamanho++;
            noAtual.setDireita(removerRecursivo(noAtual.getDireita(), menorValor));
        }

        return noAtual;
    }

    private T encontrarMenorValor(NoArvore<T> no) {
        NoArvore<T> atual = no;
        while (atual.getEsquerda() != null) {
            atual = atual.getEsquerda();
        }
        return atual.getValor();
    }

    /**
     * Retorna a quantidade total de elementos na árvore.
     */
    public int tamanho() {
        return this.tamanho;
    }

    /**
     * Informa se a árvore está vazia.
     */
    public boolean estaVazia() {
        return this.tamanho == 0;
    }

    /**
     * Calcula a altura da árvore binária.
     */
    public int altura() {
        return calcularAltura(this.raiz);
    }

    private int calcularAltura(NoArvore<T> no) {
        if (no == null) {
            return -1;
        }
        int altEsq = calcularAltura(no.getEsquerda());
        int altDir = calcularAltura(no.getDireita());
        return 1 + (altEsq > altDir ? altEsq : altDir);
    }

    /**
     * Retorna os elementos em ordem crescente (percurso em-ordem: esquerda, raiz, direita).
     */
    public ListaEncadeada<T> emOrdem() {
        ListaEncadeada<T> lista = new ListaEncadeada<>();
        percorrerEmOrdem(this.raiz, lista);
        return lista;
    }

    private void percorrerEmOrdem(NoArvore<T> no, ListaEncadeada<T> lista) {
        if (no != null) {
            percorrerEmOrdem(no.getEsquerda(), lista);
            lista.inserirFim(no.getValor());
            percorrerEmOrdem(no.getDireita(), lista);
        }
    }

    /**
     * Percurso pré-ordem (raiz, esquerda, direita).
     */
    public ListaEncadeada<T> preOrdem() {
        ListaEncadeada<T> lista = new ListaEncadeada<>();
        percorrerPreOrdem(this.raiz, lista);
        return lista;
    }

    private void percorrerPreOrdem(NoArvore<T> no, ListaEncadeada<T> lista) {
        if (no != null) {
            lista.inserirFim(no.getValor());
            percorrerPreOrdem(no.getEsquerda(), lista);
            percorrerPreOrdem(no.getDireita(), lista);
        }
    }

    /**
     * Percurso pós-ordem (esquerda, direita, raiz).
     */
    public ListaEncadeada<T> posOrdem() {
        ListaEncadeada<T> lista = new ListaEncadeada<>();
        percorrerPosOrdem(this.raiz, lista);
        return lista;
    }

    private void percorrerPosOrdem(NoArvore<T> no, ListaEncadeada<T> lista) {
        if (no != null) {
            percorrerPosOrdem(no.getEsquerda(), lista);
            percorrerPosOrdem(no.getDireita(), lista);
            lista.inserirFim(no.getValor());
        }
    }
}

