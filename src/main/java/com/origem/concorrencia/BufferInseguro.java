package com.origem.concorrencia;

/**
 * Buffer compartilhado propositalmente INSEGURO para demonstrar CONDIÇÃO DE CORRIDA (Race Condition).
 *
 * <p>Esta classe NÃO utiliza nenhuma primitiva de exclusão mútua (locks, mutexes, synchronized ou variáveis atômicas).
 * Múltiplas threads acessam e modificam simultaneamente o vetor interno, os ponteiros de escrita/leitura
 * e a variável compartilhada {@code contador}.</p>
 *
 * <p>Consequências demonstradas:</p>
 * <ul>
 *   <li>Perda de atualizações no contador (lost update em {@code contador++} e {@code contador--})</li>
 *   <li>Sobrescrita indevida de dados não consumidos (data race)</li>
 *   <li>Leitura de valores nulos ou duplicados</li>
 *   <li>Discrepância gritante entre o número de itens produzidos e consumidos</li>
 * </ul>
 *
 * @param <T> Tipo dos itens no buffer.
 */
public class BufferInseguro<T> implements BufferCompartilhado<T> {

    private final Object[] itens;
    private final int capacidade;
    private int inicio;
    private int fim;
    private int contador;

    // Métricas para evidenciar anomalias causadas pela condição de corrida
    private int sobreescritasDetectadas;
    private int leiturasNulasDetectadas;

    public BufferInseguro(int capacidade) {
        if (capacidade <= 0) {
            throw new IllegalArgumentException("Capacidade deve ser maior que zero: " + capacidade);
        }
        this.capacidade = capacidade;
        this.itens = new Object[capacidade];
        this.inicio = 0;
        this.fim = 0;
        this.contador = 0;
        this.sobreescritasDetectadas = 0;
        this.leiturasNulasDetectadas = 0;
    }

    @Override
    public void produzir(T item) throws InterruptedException {
        // Sem primitiva de sincronização: tenta esperar brevemente, mas sem lock nem condition
        int tentativas = 0;
        while (contador >= capacidade && tentativas < 200) {
            tentativas++;
            Thread.yield();
        }

        // Se a posição já continha algo diferente de nulo antes de ser consumida, houve sobrescrita
        if (itens[fim] != null) {
            sobreescritasDetectadas++;
        }

        itens[fim] = item;

        // Introduz pequena variação de escalonamento para forçar intercalação de threads
        fim = (fim + 1) % capacidade;

        // Race condition clássica: leitura, incremento e escrita não atômicos
        int temp = contador;
        Thread.yield();
        contador = temp + 1;
    }

    @Override
    @SuppressWarnings("unchecked")
    public T consumir() throws InterruptedException {
        // Sem primitiva de sincronização: tenta esperar brevemente, mas sem lock nem condition
        int tentativas = 0;
        while (contador <= 0 && tentativas < 200) {
            tentativas++;
            Thread.yield();
        }

        T item = (T) itens[inicio];
        if (item == null) {
            leiturasNulasDetectadas++;
        }

        itens[inicio] = null;
        inicio = (inicio + 1) % capacidade;

        // Race condition clássica: leitura, decremento e escrita não atômicos
        int temp = contador;
        Thread.yield();
        contador = temp - 1;

        return item;
    }

    @Override
    public int getTamanho() {
        return contador;
    }

    @Override
    public int getCapacidade() {
        return capacidade;
    }

    public int getSobreescritasDetectadas() {
        return sobreescritasDetectadas;
    }

    public int getLeiturasNulasDetectadas() {
        return leiturasNulasDetectadas;
    }
}
