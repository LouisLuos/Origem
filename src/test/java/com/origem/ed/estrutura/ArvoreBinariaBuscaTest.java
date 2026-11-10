package com.origem.ed.estrutura;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários — Árvore Binária de Busca (BST)")
class ArvoreBinariaBuscaTest {

    @Test
    @DisplayName("Deve inserir e buscar elementos preservando ordenação da BST")
    void testInsercaoEBusca() {
        ArvoreBinariaBusca<Integer> bst = new ArvoreBinariaBusca<>();
        assertTrue(bst.estaVazia());
        assertEquals(0, bst.tamanho());

        bst.inserir(50);
        bst.inserir(30);
        bst.inserir(70);
        bst.inserir(20);
        bst.inserir(40);
        bst.inserir(60);
        bst.inserir(80);

        assertEquals(7, bst.tamanho());
        assertTrue(bst.buscar(50));
        assertTrue(bst.buscar(20));
        assertTrue(bst.buscar(80));
        assertFalse(bst.buscar(99));
        assertFalse(bst.buscar(15));
    }

    @Test
    @DisplayName("Deve realizar percurso em-ordem gerando sequência estritamente crescente")
    void testPercursoEmOrdem() {
        ArvoreBinariaBusca<Integer> bst = new ArvoreBinariaBusca<>();
        int[] valores = {50, 30, 70, 20, 40, 60, 80};
        for (int v : valores) {
            bst.inserir(v);
        }

        ListaEncadeada<Integer> emOrdem = bst.emOrdem();
        assertEquals(7, emOrdem.tamanho());

        int[] esperado = {20, 30, 40, 50, 60, 70, 80};
        for (int i = 0; i < esperado.length; i++) {
            assertEquals(esperado[i], emOrdem.obter(i));
        }
    }

    @Test
    @DisplayName("Deve remover nós: folha, com 1 filho e com 2 filhos (substituição por sucessor)")
    void testRemocoesCasosClassicos() {
        ArvoreBinariaBusca<Integer> bst = new ArvoreBinariaBusca<>();
        // Árvore:
        //        50
        //      /    \
        //     30     70
        //    /  \      \
        //   20  40      80
        bst.inserir(50);
        bst.inserir(30);
        bst.inserir(70);
        bst.inserir(20);
        bst.inserir(40);
        bst.inserir(80);

        // Caso 1: remoção de folha (20)
        assertTrue(bst.remover(20));
        assertFalse(bst.buscar(20));
        assertEquals(5, bst.tamanho());

        // Caso 2: remoção de nó com 1 filho (70 tem apenas filho direito 80)
        assertTrue(bst.remover(70));
        assertFalse(bst.buscar(70));
        assertTrue(bst.buscar(80));
        assertEquals(4, bst.tamanho());

        // Caso 3: remoção de nó com 2 filhos (raiz 50)
        assertTrue(bst.remover(50));
        assertFalse(bst.buscar(50));
        assertEquals(3, bst.tamanho());

        // Valida que percurso em ordem permanece ordenado após remoções
        ListaEncadeada<Integer> ordenado = bst.emOrdem();
        assertEquals(3, ordenado.tamanho());
        assertEquals(30, ordenado.obter(0));
        assertEquals(40, ordenado.obter(1));
        assertEquals(80, ordenado.obter(2));
    }
}

