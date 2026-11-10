package com.origem.ed.algoritmo;

/**
 * Algoritmos clássicos de ordenação implementados do zero,
 * sem uso de coleções ou métodos utilitários prontos da linguagem.
 */
public class Ordenacao {

    /**
     * Insertion Sort (Ordenação por Inserção).
     * Constrói o vetor ordenado um elemento por vez, deslocando elementos maiores para a direita.
     * Melhor caso: O(n). Caso médio e pior: O(n²).
     * Espaço auxiliar: O(1).
     *
     * @param array Vetor a ser ordenado in-place.
     * @param <T>   Tipo comparável dos elementos.
     */
    public static <T extends Comparable<T>> void insertionSort(T[] array) {
        if (array == null || array.length <= 1) {
            return;
        }

        for (int i = 1; i < array.length; i++) {
            T pivo = array[i];
            int j = i - 1;

            while (j >= 0 && array[j].compareTo(pivo) > 0) {
                array[j + 1] = array[j];
                j--;
            }
            array[j + 1] = pivo;
        }
    }

    /**
     * Selection Sort (Ordenação por Seleção).
     * Seleciona iterativamente o menor elemento da porção não ordenada e o troca com o início.
     * Melhor, médio e pior caso: O(n²).
     * Espaço auxiliar: O(1).
     *
     * @param array Vetor a ser ordenado in-place.
     * @param <T>   Tipo comparável dos elementos.
     */
    public static <T extends Comparable<T>> void selectionSort(T[] array) {
        if (array == null || array.length <= 1) {
            return;
        }

        int n = array.length;
        for (int i = 0; i < n - 1; i++) {
            int indiceMenor = i;
            for (int j = i + 1; j < n; j++) {
                if (array[j].compareTo(array[indiceMenor]) < 0) {
                    indiceMenor = j;
                }
            }
            if (indiceMenor != i) {
                T temp = array[i];
                array[i] = array[indiceMenor];
                array[indiceMenor] = temp;
            }
        }
    }

    /**
     * Merge Sort (Ordenação por Intercalação).
     * Paradigma de Divisão e Conquista: divide recursivamente o vetor ao meio e intercala as metades ordenadas.
     * Complexidade de tempo (melhor, médio e pior): O(n log n).
     * Espaço auxiliar: O(n).
     *
     * @param array Vetor a ser ordenado.
     * @param <T>   Tipo comparável dos elementos.
     */
    public static <T extends Comparable<T>> void mergeSort(T[] array) {
        if (array == null || array.length <= 1) {
            return;
        }
        @SuppressWarnings("unchecked")
        T[] auxiliar = (T[]) java.lang.reflect.Array.newInstance(array.getClass().getComponentType(), array.length);
        mergeSortRecursivo(array, auxiliar, 0, array.length - 1);
    }

    private static <T extends Comparable<T>> void mergeSortRecursivo(T[] array, T[] auxiliar, int inicio, int fim) {
        if (inicio >= fim) {
            return;
        }

        int meio = inicio + (fim - inicio) / 2;
        mergeSortRecursivo(array, auxiliar, inicio, meio);
        mergeSortRecursivo(array, auxiliar, meio + 1, fim);
        intercalar(array, auxiliar, inicio, meio, fim);
    }

    private static <T extends Comparable<T>> void intercalar(T[] array, T[] auxiliar, int inicio, int meio, int fim) {
        for (int i = inicio; i <= fim; i++) {
            auxiliar[i] = array[i];
        }

        int i = inicio;
        int j = meio + 1;
        int k = inicio;

        while (i <= meio && j <= fim) {
            if (auxiliar[i].compareTo(auxiliar[j]) <= 0) {
                array[k++] = auxiliar[i++];
            } else {
                array[k++] = auxiliar[j++];
            }
        }

        while (i <= meio) {
            array[k++] = auxiliar[i++];
        }

        while (j <= fim) {
            array[k++] = auxiliar[j++];
        }
    }

    /**
     * Quick Sort (Ordenação Rápida).
     * Divisão e Conquista: escolhe um pivô, particiona os elementos menores à esquerda e maiores à direita,
     * e ordena as partições recursivamente.
     * Melhor e médio caso: O(n log n). Pior caso: O(n²).
     * Espaço auxiliar: O(log n) pilha de recursão.
     *
     * @param array Vetor a ser ordenado in-place.
     * @param <T>   Tipo comparável dos elementos.
     */
    public static <T extends Comparable<T>> void quickSort(T[] array) {
        if (array == null || array.length <= 1) {
            return;
        }
        quickSortRecursivo(array, 0, array.length - 1);
    }

    private static <T extends Comparable<T>> void quickSortRecursivo(T[] array, int baixo, int alto) {
        if (baixo < alto) {
            int indicePivo = particionar(array, baixo, alto);
            quickSortRecursivo(array, baixo, indicePivo - 1);
            quickSortRecursivo(array, indicePivo + 1, alto);
        }
    }

    private static <T extends Comparable<T>> int particionar(T[] array, int baixo, int alto) {
        // Escolha da mediana de 3 ou elemento central para reduzir risco de O(n²) em vetores já ordenados
        int meio = baixo + (alto - baixo) / 2;
        trocar(array, meio, alto);

        T pivo = array[alto];
        int i = baixo - 1;

        for (int j = baixo; j < alto; j++) {
            if (array[j].compareTo(pivo) <= 0) {
                i++;
                trocar(array, i, j);
            }
        }

        trocar(array, i + 1, alto);
        return i + 1;
    }

    private static <T> void trocar(T[] array, int i, int j) {
        T temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

