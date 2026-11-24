import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCorsOrigins } from '../../src/utils/corsOrigins.util.js';

describe('parseCorsOrigins', () => {
  it('retorna lista vazia quando não configurado', () => {
    assert.deepEqual(parseCorsOrigins(undefined), []);
    assert.deepEqual(parseCorsOrigins(''), []);
    assert.deepEqual(parseCorsOrigins(' , '), []);
  });

  it('aceita uma única origem', () => {
    assert.deepEqual(parseCorsOrigins('https://origem.vercel.app'), ['https://origem.vercel.app']);
  });

  it('aceita várias origens separadas por vírgula, removendo espaços e barras finais', () => {
    assert.deepEqual(parseCorsOrigins(' https://a.vercel.app/ ,https://b.vercel.app//,'), [
      'https://a.vercel.app',
      'https://b.vercel.app',
    ]);
  });
});
