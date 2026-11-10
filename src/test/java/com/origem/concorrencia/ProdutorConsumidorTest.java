package com.origem.concorrencia;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Concorrentes — Produtor-Consumidor (Race Condition vs Mutex/Lock)")
class ProdutorConsumidorTest {

    @Test
    @DisplayName("Buffer Sincronizado com Lock/Mutex deve processar 100% dos itens sem perda ou corrupção")
    void testBufferSincronizadoGaranteConsistencia() throws InterruptedException {
        int produtores = 4;
        int consumidores = 4;
        int itensPorThread = 100;
        int capacidadeBuffer = 10;

        ProdutorConsumidorDemonstracao.RelatorioExecucao relatorio =
                ProdutorConsumidorDemonstracao.executarSincronizado(produtores, consumidores, itensPorThread, capacidadeBuffer);

        assertNotNull(relatorio);
        assertEquals(produtores * itensPorThread, relatorio.totalProduzido);
        assertEquals(consumidores * itensPorThread, relatorio.totalConsumido);
        assertEquals(0, relatorio.saldoFinalBuffer);
        assertEquals(0, relatorio.sobreescritas);
        assertEquals(0, relatorio.leiturasNulas);
        assertTrue(relatorio.sucesso, "Buffer sincronizado deve ser 100% consistente.");
    }

    @Test
    @DisplayName("Buffer Inseguro deve evidenciar falha por Race Condition sob carga concorrente")
    void testBufferInseguroEvidenciaRaceCondition() throws InterruptedException {
        int produtores = 6;
        int consumidores = 6;
        int itensPorThread = 40;
        int capacidadeBuffer = 5;

        ProdutorConsumidorDemonstracao.RelatorioExecucao relatorio =
                ProdutorConsumidorDemonstracao.executarInseguro(produtores, consumidores, itensPorThread, capacidadeBuffer);

        assertNotNull(relatorio);
        // O buffer inseguro sem lock sofre race condition: sobreescritas, leituras nulas ou saldo corrompido
        boolean anomaliaDetectada = !relatorio.sucesso
                || relatorio.sobreescritas > 0
                || relatorio.leiturasNulas > 0
                || (relatorio.saldoFinalBuffer != (relatorio.totalProduzido - relatorio.totalConsumido));

        System.out.println("Evidência do Buffer Inseguro capturada no teste:\n" + relatorio);
        assertTrue(anomaliaDetectada, "O cenário sem lock deve evidenciar anomalias provocadas por race condition.");
    }
}

