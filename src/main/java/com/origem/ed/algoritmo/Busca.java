package com.origem.ed.algoritmo;

/**
 * Algoritmos clássicos de busca implementados do zero,
 * sem coleções ou utilitários prontos da linguagem.
 */
public class Busca {

    /**
     * Busca Sequencial (Linear Search).
     * Percorre o vetor elemento a elemento até encontrar o alvo ou alcançar o fim.
     * Funciona em vetores ordenados ou desordenados.
     * Melhor caso: O(1). Médio e Pior caso: O(n).
     *
     * @param array    Vetor no qual será feita a busca.
     * @param elemento Elemento procurado.
     * @param <T>      Tipo do elemento.
     * @return O índice da primeira ocorrência do elemento, ou -1 caso não encontrado.
     */
    public static <T> int buscaSequencial(T[] array, T elemento) {
        if (array == null || elemento == null) {
            return -1;
        }

        for (int i = 0; i < array.length; i++) {
            if (elemento.equals(array[i])) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Busca Binária (Binary Search).
     * Divide sucessivamente o intervalo de busca pela metade.
     * Requisito: O vetor DEVE estar previamente ordenado em ordem crescente.
     * Melhor caso: O(1). Médio e Pior caso: O(log n).
     *
     * @param array    Vetor previamente ordenado em ordem crescente.
     * @param elemento Elemento procurado.
     * @param <T>      Tipo comparável do elemento.
     * @return O índice onde o elemento se encontra, ou -1 caso não exista no vetor.
     */
    public static <T extends Comparable<T>> int buscaBinaria(T[] array, T elemento) {
        if (array == null || elemento == null || array.length == 0) {
            return -1;
        }

        int inicio = 0;
        int fim = array.length - 1;

        while (inicio <= fim) {
            int meio = inicio + (fim - inicio) / 2;
            int comparacao = elemento.compareTo(array[meio]);

            if (comparacao == 0) {
                return meio;
            } else if (comparacao < 0) {
                fim = meio - 1;
            } else {
                inicio = meio + 1;
            }
        }

        return -1;
    }
}

