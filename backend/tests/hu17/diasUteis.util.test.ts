import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcularDataLimiteDiasUteis,
  contarDiasUteisDecorridos,
  createCalendarioFeriados,
  createCalendarioFeriadosFromEnv,
  ehDiaUtil,
} from '../../src/utils/diasUteis.util.js';

describe('HU-17 — Cálculo oficial de dias úteis e feriados (America/Recife)', () => {
  it('pula sábados e domingos ao contar o 5º dia útil e a data limite de 7 dias úteis', () => {
    // Segunda-feira 16/11/2026 10:00-03:00
    const aprovadoEm = new Date('2026-11-16T10:00:00-03:00');

    assert.equal(
      contarDiasUteisDecorridos(aprovadoEm, new Date('2026-11-20T18:00:00-03:00')),
      4,
    );
    // Sábado 21 e Domingo 22 não contam
    assert.equal(
      contarDiasUteisDecorridos(aprovadoEm, new Date('2026-11-22T23:00:00-03:00')),
      4,
    );
    // Segunda-feira 23/11/2026 = 5º dia útil
    assert.equal(
      contarDiasUteisDecorridos(aprovadoEm, new Date('2026-11-23T09:00:00-03:00')),
      5,
    );

    const limite7 = calcularDataLimiteDiasUteis(aprovadoEm, 7);
    assert.equal(limite7.toISOString(), new Date('2026-11-25T23:59:59-03:00').toISOString());
  });

  it('respeita feriados definidos no calendário injetável sem inventar datas fixas', () => {
    const aprovadoEm = new Date('2026-11-16T10:00:00-03:00');
    const calendarioSemFeriado = createCalendarioFeriadosFromEnv('');
    const calendarioComFeriado = createCalendarioFeriados(['2026-11-19']);

    assert.equal(ehDiaUtil('2026-11-19', calendarioSemFeriado), true);
    assert.equal(ehDiaUtil('2026-11-19', calendarioComFeriado), false);

    // Com feriado em 19/11, segunda 23/11 é apenas o 4º dia útil e terça 24/11 é o 5º dia útil
    assert.equal(
      contarDiasUteisDecorridos(
        aprovadoEm,
        new Date('2026-11-23T15:00:00-03:00'),
        calendarioComFeriado,
      ),
      4,
    );
    assert.equal(
      contarDiasUteisDecorridos(
        aprovadoEm,
        new Date('2026-11-24T09:00:00-03:00'),
        calendarioComFeriado,
      ),
      5,
    );
  });
});
