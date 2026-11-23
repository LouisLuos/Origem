import { env } from '../config/env.js';
import { HttpSandboxPaymentGateway } from './httpSandbox.gateway.js';
import { MercadoPagoPaymentGateway } from './mercadoPago.gateway.js';
import { PagarmeV5PaymentGateway } from './pagarmeV5.gateway.js';
import type { AmbienteGateway, PaymentGatewayPort } from './paymentGateway.contracts.js';
import { UnconfiguredPaymentGateway } from './unconfiguredPayment.gateway.js';

export interface GatewayConfigValidationResult {
  readonly valido: boolean;
  readonly gateway: string;
  readonly configurado: boolean;
  readonly ambiente: AmbienteGateway;
  readonly erros: string[];
}

export type PaymentEnvSubset = Partial<{
  NODE_ENV: 'development' | 'production' | 'test';
  PAYMENT_GATEWAY: 'disabled' | 'pagarme_v5' | 'mercado_pago' | 'http_sandbox';
  PAYMENT_ENVIRONMENT: AmbienteGateway;
  PAYMENT_GATEWAY_TIMEOUT_MS: number;
  PAGARME_API_BASE_URL: string;
  PAGARME_SECRET_KEY: string;
  PAGARME_PUBLIC_KEY: string;
  PAGARME_WEBHOOK_SECRET: string;
  PAGARME_WEBHOOK_BASIC_USER: string;
  PAGARME_WEBHOOK_BASIC_PASS: string;
  MP_API_BASE_URL: string;
  MP_ACCESS_TOKEN: string;
  MP_WEBHOOK_SECRET: string;
  PAYMENT_HTTP_ENDPOINT: string;
  PAYMENT_HTTP_API_KEY: string;
  PAYMENT_HTTP_WEBHOOK_SECRET: string;
}>;

export function validarConfiguracaoGatewayPagamento(
  config: PaymentEnvSubset = env,
): GatewayConfigValidationResult {
  const modo = config.PAYMENT_GATEWAY ?? 'disabled';
  const ambiente = config.PAYMENT_ENVIRONMENT ?? env.PAYMENT_ENVIRONMENT;
  const erros: string[] = [];

  if (modo === 'disabled') {
    return { valido: true, gateway: 'disabled', configurado: false, ambiente, erros };
  }

  if (modo === 'pagarme_v5') {
    if (!config.PAGARME_SECRET_KEY?.trim()) {
      erros.push('PAGARME_SECRET_KEY é obrigatória quando PAYMENT_GATEWAY=pagarme_v5.');
    }
    const temHmac = Boolean(config.PAGARME_WEBHOOK_SECRET?.trim());
    const temBasic = Boolean(
      config.PAGARME_WEBHOOK_BASIC_USER?.trim() && config.PAGARME_WEBHOOK_BASIC_PASS?.trim(),
    );
    if (!temHmac && !temBasic) {
      erros.push(
        'Configure PAGARME_WEBHOOK_SECRET ou PAGARME_WEBHOOK_BASIC_USER/PASS para validar webhooks.',
      );
    }
    return {
      valido: erros.length === 0,
      gateway: 'pagarme_v5',
      configurado: erros.length === 0,
      ambiente,
      erros,
    };
  }

  if (modo === 'mercado_pago') {
    if (!config.MP_ACCESS_TOKEN?.trim()) {
      erros.push('MP_ACCESS_TOKEN é obrigatório quando PAYMENT_GATEWAY=mercado_pago.');
    }
    if (!config.MP_WEBHOOK_SECRET?.trim()) {
      erros.push('MP_WEBHOOK_SECRET é obrigatório quando PAYMENT_GATEWAY=mercado_pago.');
    }
    return {
      valido: erros.length === 0,
      gateway: 'mercado_pago',
      configurado: erros.length === 0,
      ambiente,
      erros,
    };
  }

  if (modo === 'http_sandbox') {
    if ((config.NODE_ENV ?? env.NODE_ENV) === 'production') {
      erros.push('http_sandbox é proibido em ambiente de produção.');
    }
    if (!config.PAYMENT_HTTP_ENDPOINT?.trim()) {
      erros.push('PAYMENT_HTTP_ENDPOINT é obrigatório quando PAYMENT_GATEWAY=http_sandbox.');
    }
    if (!config.PAYMENT_HTTP_WEBHOOK_SECRET?.trim()) {
      erros.push('PAYMENT_HTTP_WEBHOOK_SECRET é obrigatório quando PAYMENT_GATEWAY=http_sandbox.');
    }
    return {
      valido: erros.length === 0,
      gateway: 'http_sandbox',
      configurado: erros.length === 0,
      ambiente,
      erros,
    };
  }

  return { valido: true, gateway: 'disabled', configurado: false, ambiente, erros };
}

export function createPaymentGatewayFromEnv(config: PaymentEnvSubset = env): PaymentGatewayPort {
  const validacao = validarConfiguracaoGatewayPagamento(config);
  const timeoutMs = config.PAYMENT_GATEWAY_TIMEOUT_MS ?? env.PAYMENT_GATEWAY_TIMEOUT_MS;

  if (validacao.configurado && validacao.gateway === 'pagarme_v5' && config.PAGARME_SECRET_KEY) {
    return new PagarmeV5PaymentGateway({
      baseUrl: config.PAGARME_API_BASE_URL ?? env.PAGARME_API_BASE_URL,
      secretKey: config.PAGARME_SECRET_KEY,
      publicKey: config.PAGARME_PUBLIC_KEY,
      ambiente: validacao.ambiente,
      timeoutMs,
      webhookSecret: config.PAGARME_WEBHOOK_SECRET,
      webhookBasicUser: config.PAGARME_WEBHOOK_BASIC_USER,
      webhookBasicPass: config.PAGARME_WEBHOOK_BASIC_PASS,
    });
  }

  if (validacao.configurado && validacao.gateway === 'mercado_pago' && config.MP_ACCESS_TOKEN) {
    return new MercadoPagoPaymentGateway({
      baseUrl: config.MP_API_BASE_URL ?? env.MP_API_BASE_URL,
      accessToken: config.MP_ACCESS_TOKEN,
      ambiente: validacao.ambiente,
      timeoutMs,
      webhookSecret: config.MP_WEBHOOK_SECRET,
    });
  }

  if (
    validacao.configurado &&
    validacao.gateway === 'http_sandbox' &&
    config.PAYMENT_HTTP_ENDPOINT
  ) {
    return new HttpSandboxPaymentGateway({
      endpoint: config.PAYMENT_HTTP_ENDPOINT,
      apiKey: config.PAYMENT_HTTP_API_KEY,
      webhookSecret: config.PAYMENT_HTTP_WEBHOOK_SECRET,
      ambiente: validacao.ambiente,
      timeoutMs,
    });
  }

  return new UnconfiguredPaymentGateway();
}
