package com.origem.ed.estrutura;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários — Pilha (LIFO)")
class PilhaTest {

    @Test
    @DisplayName("Deve empilhar, espiar e desempilhar na ordem LIFO correta")
    void testOperacoesPilha() {
        Pilha<String> pilha = new Pilha<>();
        assertTrue(pilha.estaVazia());
        assertEquals(0, pilha.tamanho());

        pilha.push("Ação 1");
        pilha.push("Ação 2");
        pilha.push("Ação 3");

        assertEquals(3, pilha.tamanho());
        assertFalse(pilha.estaVazia());
        assertEquals("Ação 3", pilha.peek());

        assertEquals("Ação 3", pilha.pop());
        assertEquals("Ação 2", pilha.pop());
        assertEquals(1, pilha.tamanho());
        assertEquals("Ação 1", pilha.peek());

        assertEquals("Ação 1", pilha.pop());
        assertTrue(pilha.estaVazia());
    }

    @Test
    @DisplayName("Deve lançar exceção ao desempilhar ou espiar pilha vazia")
    void testPilhaVazia() {
        Pilha<Integer> pilha = new Pilha<>();
        assertThrows(IllegalStateException.class, pilha::pop);
        assertThrows(IllegalStateException.class, pilha::peek);
    }
}

