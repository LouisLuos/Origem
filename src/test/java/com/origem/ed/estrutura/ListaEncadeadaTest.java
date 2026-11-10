package com.origem.ed.estrutura;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários — Lista Encadeada")
class ListaEncadeadaTest {

    @Test
    @DisplayName("Deve inserir elementos no início, fim e posições específicas")
    void testInsercoes() {
        ListaEncadeada<String> lista = new ListaEncadeada<>();
        assertTrue(lista.estaVazia());
        assertEquals(0, lista.tamanho());

        lista.inserirFim("Bolo de Rolo");
        lista.inserirInicio("Cerâmica Figurativa");
        lista.inserirFim("Renda Renascença");

        assertEquals(3, lista.tamanho());
        assertEquals("Cerâmica Figurativa", lista.obter(0));
        assertEquals("Bolo de Rolo", lista.obter(1));
        assertEquals("Renda Renascença", lista.obter(2));

        lista.inserirNaPosicao(1, "Xilogravura");
        assertEquals(4, lista.tamanho());
        assertEquals("Xilogravura", lista.obter(1));
        assertEquals("Bolo de Rolo", lista.obter(2));
    }

    @Test
    @DisplayName("Deve remover elementos do início, fim, por valor e por índice")
    void testRemocoes() {
        ListaEncadeada<Integer> lista = new ListaEncadeada<>();
        lista.inserir(10);
        lista.inserir(20);
        lista.inserir(30);
        lista.inserir(40);

        assertEquals(10, lista.removerInicio());
        assertEquals(3, lista.tamanho());

        assertEquals(40, lista.removerFim());
        assertEquals(2, lista.tamanho());

        assertTrue(lista.remover(Integer.valueOf(20)));
        assertFalse(lista.contem(20));
        assertEquals(1, lista.tamanho());
        assertEquals(30, lista.obter(0));

        assertEquals(30, lista.removerDaPosicao(0));
        assertTrue(lista.estaVazia());
    }

    @Test
    @DisplayName("Deve lançar exceções ao tentar obter ou remover de posições inválidas")
    void testExcecoesLimites() {
        ListaEncadeada<String> lista = new ListaEncadeada<>();
        assertThrows(IllegalStateException.class, lista::removerInicio);
        assertThrows(IllegalStateException.class, lista::removerFim);
        assertThrows(IndexOutOfBoundsException.class, () -> lista.obter(0));
        assertThrows(IndexOutOfBoundsException.class, () -> lista.inserirNaPosicao(5, "Item"));
    }

    @Test
    @DisplayName("Deve converter lista encadeada para vetor com sucesso")
    void testParaArray() {
        ListaEncadeada<String> lista = new ListaEncadeada<>();
        lista.inserir("Item 1");
        lista.inserir("Item 2");
        lista.inserir("Item 3");

        String[] array = lista.paraArray(new String[0]);
        assertEquals(3, array.length);
        assertEquals("Item 1", array[0]);
        assertEquals("Item 2", array[1]);
        assertEquals("Item 3", array[2]);
    }
}

