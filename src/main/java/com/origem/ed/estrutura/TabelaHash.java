package com.origem.ed.estrutura;

/**
 * Implementação manual de Tabela de Dispersão (Hash Table / Tabela Hash)
 * desenvolvida do zero sem nenhuma classe de coleções padrão (sem Map/HashMap).
 * Tratamento de colisões implementado via Encadeamento Separado (Separate Chaining)
 * e redimensionamento dinâmico (rehashing) com fator de carga padrão de 0.75.
 *
 * @param <K> Tipo da chave.
 * @param <V> Tipo do valor associado.
 */
public class TabelaHash<K, V> {

    /**
     * Entrada interna para armazenar os pares chave-valor e referenciar
     * o próximo elemento na lista de colisão do balde (bucket).
     */
    public static class Entrada<K, V> {
        private final K chave;
        private V valor;
        private Entrada<K, V> proximo;

        public Entrada(K chave, V valor, Entrada<K, V> proximo) {
            this.chave = chave;
            this.valor = valor;
            this.proximo = proximo;
        }

        public K getChave() {
            return chave;
        }

        public V getValor() {
            return valor;
        }

        public void setValor(V valor) {
            this.valor = valor;
        }

        public Entrada<K, V> getProximo() {
            return proximo;
        }

        public void setProximo(Entrada<K, V> proximo) {
            this.proximo = proximo;
        }
    }

    private static final int CAPACIDADE_INICIAL_PADRAO = 16;
    private static final float FATOR_CARGA_PADRAO = 0.75f;

    private Entrada<K, V>[] baldes;
    private int capacidade;
    private int tamanho;
    private final float fatorCarga;

    @SuppressWarnings("unchecked")
    public TabelaHash(int capacidadeInicial, float fatorCarga) {
        if (capacidadeInicial <= 0) {
            throw new IllegalArgumentException("Capacidade inicial inválida: " + capacidadeInicial);
        }
        if (fatorCarga <= 0.0f || Float.isNaN(fatorCarga)) {
            throw new IllegalArgumentException("Fator de carga inválido: " + fatorCarga);
        }
        this.capacidade = capacidadeInicial;
        this.fatorCarga = fatorCarga;
        this.baldes = (Entrada<K, V>[]) new Entrada[capacidade];
        this.tamanho = 0;
    }

    public TabelaHash() {
        this(CAPACIDADE_INICIAL_PADRAO, FATOR_CARGA_PADRAO);
    }

    /**
     * Insere ou atualiza um par chave-valor na tabela hash.
     * Complexidade média: O(1). Pior caso: O(n).
     */
    public void inserir(K chave, V valor) {
        if (chave == null) {
            throw new IllegalArgumentException("Chave não pode ser nula.");
        }

        int indice = calcularIndice(chave, this.capacidade);
        Entrada<K, V> atual = this.baldes[indice];

        // Se a chave já existir no balde, atualiza seu valor
        while (atual != null) {
            if (atual.getChave().equals(chave)) {
                atual.setValor(valor);
                return;
            }
            atual = atual.getProximo();
        }

        // Insere nova entrada na cabeça da lista do balde
        Entrada<K, V> novaEntrada = new Entrada<>(chave, valor, this.baldes[indice]);
        this.baldes[indice] = novaEntrada;
        this.tamanho++;

        // Verifica necessidade de redimensionamento
        if ((float) this.tamanho / this.capacidade >= this.fatorCarga) {
            redimensionar();
        }
    }

    /**
     * Obtém o valor associado à chave informada.
     * Complexidade média: O(1). Pior caso: O(n).
     */
    public V obter(K chave) {
        if (chave == null) {
            return null;
        }

        int indice = calcularIndice(chave, this.capacidade);
        Entrada<K, V> atual = this.baldes[indice];

        while (atual != null) {
            if (atual.getChave().equals(chave)) {
                return atual.getValor();
            }
            atual = atual.getProximo();
        }

        return null;
    }

    /**
     * Verifica se a chave existe na tabela hash.
     */
    public boolean contemChave(K chave) {
        return obter(chave) != null;
    }

    /**
     * Remove o par associado à chave e retorna o valor removido.
     * Complexidade média: O(1). Pior caso: O(n).
     */
    public V remover(K chave) {
        if (chave == null) {
            return null;
        }

        int indice = calcularIndice(chave, this.capacidade);
        Entrada<K, V> atual = this.baldes[indice];
        Entrada<K, V> anterior = null;

        while (atual != null) {
            if (atual.getChave().equals(chave)) {
                if (anterior == null) {
                    this.baldes[indice] = atual.getProximo();
                } else {
                    anterior.setProximo(atual.getProximo());
                }
                this.tamanho--;
                return atual.getValor();
            }
            anterior = atual;
            atual = atual.getProximo();
        }

        return null;
    }

    /**
     * Retorna o total de pares chave-valor armazenados.
     */
    public int tamanho() {
        return this.tamanho;
    }

    /**
     * Informa se a tabela está vazia.
     */
    public boolean estaVazia() {
        return this.tamanho == 0;
    }

    /**
     * Retorna a capacidade atual de baldes.
     */
    public int capacidade() {
        return this.capacidade;
    }

    /**
     * Limpa a tabela hash.
     */
    @SuppressWarnings("unchecked")
    public void limpar() {
        this.baldes = (Entrada<K, V>[]) new Entrada[this.capacidade];
        this.tamanho = 0;
    }

    /**
     * Função hash para dispersão e mapeamento para um índice do vetor de baldes.
     */
    private int calcularIndice(K chave, int cap) {
        int hash = chave.hashCode();
        return (hash & 0x7fffffff) % cap;
    }

    /**
     * Redimensiona o vetor de baldes (dobra a capacidade) e redistribui as entradas (rehashing).
     */
    @SuppressWarnings("unchecked")
    private void redimensionar() {
        int novaCapacidade = this.capacidade * 2;
        Entrada<K, V>[] novosBaldes = (Entrada<K, V>[]) new Entrada[novaCapacidade];

        for (int i = 0; i < this.capacidade; i++) {
            Entrada<K, V> atual = this.baldes[i];
            while (atual != null) {
                Entrada<K, V> proximo = atual.getProximo();
                int novoIndice = calcularIndice(atual.getChave(), novaCapacidade);

                atual.setProximo(novosBaldes[novoIndice]);
                novosBaldes[novoIndice] = atual;

                atual = proximo;
            }
        }

        this.baldes = novosBaldes;
        this.capacidade = novaCapacidade;
    }
}

