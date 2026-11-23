import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { AppError } from '../../src/utils/AppError.js';
import {
  PIX_CRYPTO_ERROR_CODES,
  createPixCryptoService,
} from '../../src/utils/pixCrypto.util.js';

const KEY_HEX = crypto.randomBytes(32).toString('hex');
const KEY_BASE64 = crypto.randomBytes(32).toString('base64');
const OTHER_KEY_HEX = crypto.randomBytes(32).toString('hex');

function flipFirstByteBase64(segment: string): string {
  const buf = Buffer.from(segment, 'base64');
  buf[0] = (buf[0] ?? 0) ^ 0x01;
  return buf.toString('base64');
}

describe('Etapa C2 — Criptografia autenticada AES-256-GCM da Chave Pix', () => {
  it('criptografa e descriptografa corretamente os 4 formatos Pix (chave hex e base64)', () => {
    const hexCrypto = createPixCryptoService(() => KEY_HEX);
    const b64Crypto = createPixCryptoService(() => KEY_BASE64);

    const samples = [
      '52998224725',
      'mestre.severino@origem.pe.br',
      '+5581999998888',
      '550e8400-e29b-41d4-a716-446655440000',
    ];

    for (const sample of samples) {
      const c1 = hexCrypto.encrypt(sample, 'origem:pix:v1:user-1');
      assert.notEqual(c1.includes(sample), true);
      assert.equal(hexCrypto.decrypt(c1, 'origem:pix:v1:user-1'), sample);

      const c2 = b64Crypto.encrypt(sample);
      assert.equal(b64Crypto.decrypt(c2), sample);
    }
  });

  it('gera IV e ciphertext distintos a cada operação para o mesmo plaintext', () => {
    const service = createPixCryptoService(() => KEY_HEX);
    const enc1 = service.encrypt('52998224725');
    const enc2 = service.encrypt('52998224725');

    assert.notEqual(enc1, enc2);
    const parts1 = enc1.split(':');
    const parts2 = enc2.split(':');
    assert.equal(parts1.length, 4);
    assert.equal(parts2.length, 4);
    assert.equal(parts1[0], 'v1');
    assert.notEqual(parts1[1], parts2[1]); // IV exclusivo
    assert.notEqual(parts1[3], parts2[3]); // Ciphertext distinto
  });

  it('falha com erro controlado ao usar chave incorreta de descriptografia', () => {
    const encryptor = createPixCryptoService(() => KEY_HEX);
    const wrongDecryptor = createPixCryptoService(() => OTHER_KEY_HEX);

    const secretPix = '+5581999998888';
    const payload = encryptor.encrypt(secretPix);

    assert.throws(
      () => wrongDecryptor.decrypt(payload),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.code, PIX_CRYPTO_ERROR_CODES.FALHA_DESCRIPTOGRAFIA);
        assert.equal(err.message.includes(KEY_HEX), false);
        assert.equal(err.message.includes(OTHER_KEY_HEX), false);
        assert.equal(err.message.includes(secretPix), false);
        return true;
      },
    );
  });

  it('detecta adulteração em ciphertext, IV, authTag, AAD ou formato inválido', () => {
    const service = createPixCryptoService(() => KEY_HEX);
    const aad = 'origem:pix:v1:artesao-123';
    const payload = service.encrypt('52998224725', aad);
    const [version, ivB64, tagB64, cipherB64] = payload.split(':');

    const tamperedVariants = [
      `${version}:${flipFirstByteBase64(ivB64)}:${tagB64}:${cipherB64}`,
      `${version}:${ivB64}:${flipFirstByteBase64(tagB64)}:${cipherB64}`,
      `${version}:${ivB64}:${tagB64}:${flipFirstByteBase64(cipherB64)}`,
      `v2:${ivB64}:${tagB64}:${cipherB64}`,
      `${version}:${ivB64}:${tagB64}`,
      `${version}:!!!:${tagB64}:${cipherB64}`,
      '',
    ];

    for (const badPayload of tamperedVariants) {
      assert.throws(
        () => service.decrypt(badPayload, aad),
        (err: unknown) =>
          err instanceof AppError && err.code === PIX_CRYPTO_ERROR_CODES.FALHA_DESCRIPTOGRAFIA,
      );
    }

    // AAD divergente ou omitido também invalida a autenticação GCM
    assert.throws(
      () => service.decrypt(payload, 'origem:pix:v1:artesao-999'),
      (err: unknown) =>
        err instanceof AppError && err.code === PIX_CRYPTO_ERROR_CODES.FALHA_DESCRIPTOGRAFIA,
    );
    assert.throws(
      () => service.decrypt(payload),
      (err: unknown) =>
        err instanceof AppError && err.code === PIX_CRYPTO_ERROR_CODES.FALHA_DESCRIPTOGRAFIA,
    );
  });

  it('rejeita configuração criptográfica ausente ou inválida sem vazar material de chave', () => {
    const validEncryptor = createPixCryptoService(() => KEY_HEX);
    const validCipher = validEncryptor.encrypt('52998224725');

    const badConfigs = [undefined, '', '   ', '00'.repeat(32), 'chave-curta'];

    for (const badConfig of badConfigs) {
      const brokenService = createPixCryptoService(() => badConfig);
      assert.throws(
        () => brokenService.encrypt('52998224725'),
        (err: unknown) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.code, PIX_CRYPTO_ERROR_CODES.CONFIG_INVALIDA);
          if (badConfig) {
            assert.equal(err.message.includes(badConfig), false);
          }
          return true;
        },
      );
      assert.throws(
        () => brokenService.decrypt(validCipher),
        (err: unknown) =>
          err instanceof AppError && err.code === PIX_CRYPTO_ERROR_CODES.CONFIG_INVALIDA,
      );
    }
  });

  it('rejeita entrada vazia para criptografia com erro 400', () => {
    const service = createPixCryptoService(() => KEY_HEX);
    assert.throws(
      () => service.encrypt('   '),
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.code === PIX_CRYPTO_ERROR_CODES.ENTRADA_INVALIDA,
    );
  });
});
