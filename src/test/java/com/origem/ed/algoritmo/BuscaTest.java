package com.origem.ed.algoritmo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários — Algoritmos de Busca")
class BuscaTest {

    @Test
    @DisplayName("Busca Sequencial deve encontrar elementos existentes e retornar -1 para ausentes")
    void testBuscaSequencial() {
        String[] artesanato = {"Barro", "Madeira", "Renda", "Xilogravura", "Couro"};

        assertEquals(0, Busca.buscaSequencial(artesanato, "Barro"));
        assertEquals(2, Busca.buscaSequencial(artesanato, "Renda"));
        assertEquals(4, Busca.buscaSequencial(artesanato, "Couro"));
        assertEquals(-1, Busca.buscaSequencial(artesanato, "Plástico"));
        assertEquals(-1, Busca.buscaSequencial(artesanato, null));
    }

    @Test
    @DisplayName("Busca Binária deve localizar índices exatos em O(log n) e retornar -1 para ausentes")
    void testBuscaBinaria() {
        Integer[] numerosOrdenados = {10, 20, 30, 40, 50, 60, 70, 80, 90};

        assertEquals(0, Busca.buscaBinaria(numerosOrdenados, 10));
        assertEquals(4, Busca.buscaBinaria(numerosOrdenados, 50));
        assertEquals(8, Busca.buscaBinaria(numerosOrdenados, 90));

        assertEquals(-1, Busca.buscaBinaria(numerosOrdenados, 5));
        assertEquals(-1, Busca.buscaBinaria(numerosOrdenados, 55));
        assertEquals(-1, Busca.buscaBinaria(numerosOrdenados, 95));
        assertEquals(-1, Busca.buscaBinaria(null, 50));
    }
}

