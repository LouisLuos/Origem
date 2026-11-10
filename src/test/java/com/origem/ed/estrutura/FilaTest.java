package com.origem.ed.estrutura;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários — Fila Encadeada (FIFO)")
class FilaTest {

    @Test
    @DisplayName("Deve enfileirar e desenfileirar na ordem FIFO correta")
    void testOperacoesFila() {
        Fila<String> fila = new Fila<>();
        assertTrue(fila.estaVazia());
        assertEquals(0, fila.tamanho());

        fila.enfileirar("Pedido #101");
        fila.enfileirar("Pedido #102");
        fila.enfileirar("Pedido #103");

        assertEquals(3, fila.tamanho());
        assertEquals("Pedido #101", fila.primeiro());

        assertEquals("Pedido #101", fila.desenfileirar());
        assertEquals("Pedido #102", fila.primeiro());
        assertEquals(2, fila.tamanho());

        assertEquals("Pedido #102", fila.desenfileirar());
        assertEquals("Pedido #103", fila.desenfileirar());
        assertTrue(fila.estaVazia());
    }

    @Test
    @DisplayName("Deve lançar exceção ao desenfileirar ou consultar primeiro em fila vazia")
    void testFilaVazia() {
        Fila<Integer> fila = new Fila<>();
        assertThrows(IllegalStateException.class, fila::desenfileirar);
        assertThrows(IllegalStateException.class, fila::primeiro);
    }
}

