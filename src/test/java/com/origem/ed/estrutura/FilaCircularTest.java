package com.origem.ed.estrutura;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários — Fila Circular")
class FilaCircularTest {

    @Test
    @DisplayName("Deve enfileirar, desenfileirar e reaproveitar os índices de forma circular")
    void testFuncionamentoCircular() {
        FilaCircular<Integer> fila = new FilaCircular<>(3);
        assertTrue(fila.estaVazia());
        assertFalse(fila.estaCheia());
        assertEquals(3, fila.capacidade());

        fila.enfileirar(10);
        fila.enfileirar(20);
        fila.enfileirar(30);

        assertTrue(fila.estaCheia());
        assertEquals(3, fila.tamanho());
        assertEquals(10, fila.primeiro());

        // Não deve permitir enfileirar quando cheia
        assertThrows(IllegalStateException.class, () -> fila.enfileirar(40));

        // Desenfileira dois elementos (libera espaço no início)
        assertEquals(10, fila.desenfileirar());
        assertEquals(20, fila.desenfileirar());
        assertEquals(1, fila.tamanho());
        assertEquals(30, fila.primeiro());

        // Enfileira novos elementos dando a volta circular no vetor interno
        fila.enfileirar(40);
        fila.enfileirar(50);
        assertTrue(fila.estaCheia());
        assertEquals(3, fila.tamanho());

        assertEquals(30, fila.desenfileirar());
        assertEquals(40, fila.desenfileirar());
        assertEquals(50, fila.desenfileirar());
        assertTrue(fila.estaVazia());
    }

    @Test
    @DisplayName("Deve lançar exceções para capacidade inválida e operações com fila vazia")
    void testCasosBorda() {
        assertThrows(IllegalArgumentException.class, () -> new FilaCircular<>(0));
        assertThrows(IllegalArgumentException.class, () -> new FilaCircular<>(-5));

        FilaCircular<String> fila = new FilaCircular<>(2);
        assertThrows(IllegalStateException.class, fila::desenfileirar);
        assertThrows(IllegalStateException.class, fila::primeiro);
    }
}

