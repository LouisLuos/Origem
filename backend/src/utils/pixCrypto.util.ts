import crypto from 'node:crypto';
import { env, isValidAes256KeyMaterial } from '../config/env.js';
import { AppError } from './AppError.js';

export const PIX_CRYPTO_ERROR_CODES = {
  CONFIG_INVALIDA: 'PIX_CRYPTO_CONFIG_INVALIDA',
  ENTRADA_INVALIDA: 'PIX_CRYPTO_ENTRADA_INVALIDA',
  FALHA_DESCRIPTOGRAFIA: 'PIX_CRYPTO_FALHA_DESCRIPTOGRAFIA',
} as const;

export const PIX_CIPHER_VERSION = 'v1';
export const PIX_IV_LENGTH_BYTES = 12;
export const PIX_AUTH_TAG_LENGTH_BYTES = 16;

const BASE64_STRICT_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;

export interface PixCryptoService {
  encrypt(plaintext: string, aad?: string): string;
  decrypt(serializedPayload: string, aad?: string): string;
}

function parseAes256KeyBuffer(rawKey: string | undefined): Buffer {
  if (!rawKey || !isValidAes256KeyMaterial(rawKey)) {
    throw new AppError(
      'Configuração criptográfica da Chave Pix ausente ou inválida.',
      500,
      PIX_CRYPTO_ERROR_CODES.CONFIG_INVALIDA,
    );
  }

  const trimmed = rawKey.trim();
  return HEX_64_REGEX.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : Buffer.from(trimmed, 'base64');
}

function decodeStrictBase64(segment: string): Buffer | null {
  if (!segment || segment.length % 4 !== 0 || !BASE64_STRICT_REGEX.test(segment)) {
    return null;
  }

  const decoded = Buffer.from(segment, 'base64');
  return decoded.toString('base64') === segment ? decoded : null;
}

function createDecryptionFailureError(): AppError {
  return new AppError(
    'Não foi possível validar ou descriptografar a Chave Pix protegida.',
    500,
    PIX_CRYPTO_ERROR_CODES.FALHA_DESCRIPTOGRAFIA,
  );
}

/**
 * Cria serviço de criptografia autenticada AES-256-GCM desacoplado da persistência.
 * Gera um IV exclusivo de 12 bytes por operação e nunca expõe chaves ou plaintext em erros.
 */
export function createPixCryptoService(getKey: () => string | undefined): PixCryptoService {
  return {
    encrypt(plaintext: string, aad?: string): string {
      if (typeof plaintext !== 'string' || plaintext.trim().length === 0) {
        throw new AppError(
          'Valor da Chave Pix para proteção criptográfica é obrigatório.',
          400,
          PIX_CRYPTO_ERROR_CODES.ENTRADA_INVALIDA,
        );
      }

      const key = parseAes256KeyBuffer(getKey());
      try {
        const iv = crypto.randomBytes(PIX_IV_LENGTH_BYTES);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
          authTagLength: PIX_AUTH_TAG_LENGTH_BYTES,
        });

        if (aad !== undefined && aad.length > 0) {
          cipher.setAAD(Buffer.from(aad, 'utf8'));
        }

        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return `${PIX_CIPHER_VERSION}:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
      } finally {
        key.fill(0);
      }
    },

    decrypt(serializedPayload: string, aad?: string): string {
      if (typeof serializedPayload !== 'string' || serializedPayload.length === 0) {
        throw createDecryptionFailureError();
      }

      const parts = serializedPayload.split(':');
      if (parts.length !== 4 || parts[0] !== PIX_CIPHER_VERSION) {
        throw createDecryptionFailureError();
      }

      const iv = decodeStrictBase64(parts[1]);
      const authTag = decodeStrictBase64(parts[2]);
      const ciphertext = decodeStrictBase64(parts[3]);

      if (
        !iv ||
        iv.length !== PIX_IV_LENGTH_BYTES ||
        !authTag ||
        authTag.length !== PIX_AUTH_TAG_LENGTH_BYTES ||
        !ciphertext ||
        ciphertext.length === 0
      ) {
        throw createDecryptionFailureError();
      }

      const key = parseAes256KeyBuffer(getKey());
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
          authTagLength: PIX_AUTH_TAG_LENGTH_BYTES,
        });

        if (aad !== undefined && aad.length > 0) {
          decipher.setAAD(Buffer.from(aad, 'utf8'));
        }

        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted.toString('utf8');
      } catch {
        throw createDecryptionFailureError();
      } finally {
        key.fill(0);
      }
    },
  };
}

/** Instância padrão que lê exclusivamente da configuração validada (`PIX_ENCRYPTION_KEY`). */
export const pixCryptoService: PixCryptoService = createPixCryptoService(
  () => env.PIX_ENCRYPTION_KEY,
);
