package com.origem.ed.algoritmo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários — Algoritmos de Ordenação")
class OrdenacaoTest {

    private final Integer[] dadosDesordenados = {64, 25, 12, 22, 11, 90, 42, 8};
    private final Integer[] esperado = {8, 11, 12, 22, 25, 42, 64, 90};

    @Test
    @DisplayName("Insertion Sort deve ordenar corretamente vetores desordenados e repetidos")
    void testInsertionSort() {
        Integer[] array = dadosDesordenados.clone();
        Ordenacao.insertionSort(array);
        assertArrayEquals(esperado, array);

        Integer[] repetidos = {5, 2, 8, 5, 2, 1};
        Ordenacao.insertionSort(repetidos);
        assertArrayEquals(new Integer[]{1, 2, 2, 5, 5, 8}, repetidos);
    }

    @Test
    @DisplayName("Selection Sort deve ordenar corretamente vetores desordenados")
    void testSelectionSort() {
        Integer[] array = dadosDesordenados.clone();
        Ordenacao.selectionSort(array);
        assertArrayEquals(esperado, array);
    }

    @Test
    @DisplayName("Merge Sort deve ordenar corretamente vetores pares, ímpares e grandes")
    void testMergeSort() {
        Integer[] array = dadosDesordenados.clone();
        Ordenacao.mergeSort(array);
        assertArrayEquals(esperado, array);

        Integer[] impar = {9, 1, 8, 2, 7, 3, 6};
        Ordenacao.mergeSort(impar);
        assertArrayEquals(new Integer[]{1, 2, 3, 6, 7, 8, 9}, impar);
    }

    @Test
    @DisplayName("Quick Sort deve particionar e ordenar corretamente com pivô")
    void testQuickSort() {
        Integer[] array = dadosDesordenados.clone();
        Ordenacao.quickSort(array);
        assertArrayEquals(esperado, array);

        Integer[] ordenadoInverso = {5, 4, 3, 2, 1};
        Ordenacao.quickSort(ordenadoInverso);
        assertArrayEquals(new Integer[]{1, 2, 3, 4, 5}, ordenadoInverso);
    }

    @Test
    @DisplayName("Deve lidar com vetores nulos, vazios ou de tamanho unitário sem erros")
    void testCasosBorda() {
        Integer[] vazio = new Integer[0];
        Ordenacao.insertionSort(vazio);
        Ordenacao.selectionSort(vazio);
        Ordenacao.mergeSort(vazio);
        Ordenacao.quickSort(vazio);
        assertEquals(0, vazio.length);

        Integer[] unitario = {42};
        Ordenacao.insertionSort(unitario);
        Ordenacao.selectionSort(unitario);
        Ordenacao.mergeSort(unitario);
        Ordenacao.quickSort(unitario);
        assertEquals(42, unitario[0]);
    }
}

