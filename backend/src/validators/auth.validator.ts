import { z } from 'zod';

function normalizeCpfCnpj(value: string): string {
  return value.replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const calculateDigit = (slice: string, factor: number) => {
    const sum = [...slice].reduce((total, digit) => total + Number(digit) * factor--, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(value.slice(0, 9), 10) === Number(value[9]) &&
    calculateDigit(value.slice(0, 10), 11) === Number(value[10])
  );
}

function isValidCnpj(value: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;

  const calculateDigit = (slice: string, weights: number[]) => {
    const sum = [...slice].reduce(
      (total, character, index) =>
        total + (character.charCodeAt(0) - 48) * weights[index]!,
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(value.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return firstDigit === Number(value[12]) && secondDigit === Number(value[13]);
}

export function isValidCpfCnpj(value: string): boolean {
  const normalized = normalizeCpfCnpj(value);
  return normalized.length === 11 ? isValidCpf(normalized) : isValidCnpj(normalized);
}

function normalizeWhatsapp(value: string): string {
  let digits = digitsOnly(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits;
}

export const strongPasswordSchema = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'A senha excede o limite aceito.')
  .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiúscula.')
  .regex(/\d/, 'A senha deve conter ao menos um número.')
  .regex(/[^A-Za-z0-9]/, 'A senha deve conter ao menos um símbolo.');

export const registerBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Informe seu nome completo.')
      .max(160, 'O nome deve ter no máximo 160 caracteres.')
      .refine((value) => value.split(/\s+/).length >= 2, 'Informe seu nome completo.'),
    email: z
      .string()
      .trim()
      .email('E-mail inválido.')
      .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
      .transform((value) => value.toLowerCase()),
    cpfCnpj: z
      .string()
      .trim()
      .refine(isValidCpfCnpj, 'Informe um CPF ou CNPJ válido.')
      .transform(normalizeCpfCnpj),
    whatsapp: z
      .string()
      .trim()
      .transform(normalizeWhatsapp)
      .refine((value) => /^\d{10,11}$/.test(value), 'Informe um telefone WhatsApp válido com DDD.'),
    password: strongPasswordSchema,
  })
  .strict();

export const forgotPasswordBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('E-mail inválido.')
      .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
      .transform((value) => value.toLowerCase()),
  })
  .strict();

export const resetPasswordBodySchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Link de recuperação inválido.'),
    password: strongPasswordSchema,
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().trim().email('E-mail inválido.').transform((value) => value.toLowerCase()),
    password: z.string().min(1, 'Informe sua senha.').max(72),
  })
  .strict();

export const updateProfileBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Informe seu nome completo.')
      .max(160, 'O nome deve ter no máximo 160 caracteres.')
      .refine((value) => value.split(/\s+/).length >= 2, 'Informe seu nome completo.'),
  })
  .strict();
