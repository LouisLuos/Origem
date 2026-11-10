package com.origem.ed.estrutura;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários — Tabela Hash")
class TabelaHashTest {

    @Test
    @DisplayName("Deve inserir, obter e sobrescrever valores por chave")
    void testInsercaoEObtencao() {
        TabelaHash<String, Double> precos = new TabelaHash<>();
        assertTrue(precos.estaVazia());

        precos.inserir("prod-01", 120.50);
        precos.inserir("prod-02", 85.00);
        precos.inserir("prod-03", 310.00);

        assertEquals(3, precos.tamanho());
        assertEquals(120.50, precos.obter("prod-01"));
        assertEquals(85.00, precos.obter("prod-02"));
        assertEquals(310.00, precos.obter("prod-03"));
        assertNull(precos.obter("inexistente"));

        // Sobrescrita da chave existente
        precos.inserir("prod-01", 150.00);
        assertEquals(3, precos.tamanho());
        assertEquals(150.00, precos.obter("prod-01"));
    }

    @Test
    @DisplayName("Deve lidar com colisões e redimensionamento automático (rehashing)")
    void testColisoesERehashing() {
        // Capacidade pequena para forçar colisões e redimensionamento rápido
        TabelaHash<Integer, String> tabela = new TabelaHash<>(4, 0.75f);

        for (int i = 0; i < 30; i++) {
            tabela.inserir(i, "Valor-" + i);
        }

        assertEquals(30, tabela.tamanho());
        assertTrue(tabela.capacidade() > 4);

        for (int i = 0; i < 30; i++) {
            assertEquals("Valor-" + i, tabela.obter(i));
            assertTrue(tabela.contemChave(i));
        }
    }

    @Test
    @DisplayName("Deve remover chaves existentes corretamente")
    void testRemocao() {
        TabelaHash<String, String> usuarios = new TabelaHash<>();
        usuarios.inserir("mestre_vitalino", "Caruaru");
        usuarios.inserir("ana_marcenaria", "Olinda");

        assertTrue(usuarios.contemChave("mestre_vitalino"));
        assertEquals("Caruaru", usuarios.remover("mestre_vitalino"));
        assertFalse(usuarios.contemChave("mestre_vitalino"));
        assertNull(usuarios.obter("mestre_vitalino"));
        assertEquals(1, usuarios.tamanho());

        assertNull(usuarios.remover("chave_inexistente"));
    }
}

