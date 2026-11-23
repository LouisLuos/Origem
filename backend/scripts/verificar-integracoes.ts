import nodemailer from 'nodemailer';
import { pingRedis } from '../src/cache/redis.client.js';
import { prisma } from '../src/config/database.js';
import { env, isValidAes256KeyMaterial } from '../src/config/env.js';
import { resolverDriverFotos } from '../src/config/fotosStorage.js';
import { validarConfiguracaoProvedorEmail } from '../src/integrations/email.provider.js';
import { validarConfiguracaoProvedorFrete } from '../src/integrations/frete.provider.js';
import { validarConfiguracaoGatewayPagamento } from '../src/integrations/paymentGateway.factory.js';
import { validarConfiguracaoProvedorWhatsapp } from '../src/integrations/whatsapp.provider.js';
import { sanitizarErroProvedor } from '../src/utils/notificationPrivacy.util.js';

interface DiagnosticoIntegracaoItem {
  readonly servico: string;
  readonly configurado: boolean;
  readonly conectado: boolean | null;
  readonly modo: string;
  readonly detalhes: string[];
}

async function verificarSmtpSeAtivo(): Promise<{
  readonly verificado: boolean;
  readonly erro?: string;
}> {
  if (env.EMAIL_PROVIDER !== 'smtp' || !env.SMTP_HOST?.trim()) {
    return { verificado: false };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    connectionTimeout: 4000,
    greetingTimeout: 4000,
  });

  try {
    await transporter.verify();
    return { verificado: true };
  } catch (err) {
    return { verificado: false, erro: sanitizarErroProvedor(err) };
  } finally {
    transporter.close();
  }
}

async function main(): Promise<void> {
  const itens: DiagnosticoIntegracaoItem[] = [];

  // 1. PostgreSQL / Supabase + Migrations
  let pgConectado = false;
  let pgDetalhes: string[] = [];
  try {
    const migrations = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL
    `;
    pgConectado = true;
    pgDetalhes = [`${migrations[0]?.total ?? 0} migrations aplicadas com sucesso.`];
  } catch (err) {
    pgDetalhes = [sanitizarErroProvedor(err)];
  }
  itens.push({
    servico: 'PostgreSQL / Supabase',
    configurado: true,
    conectado: pgConectado,
    modo: 'prisma-pg',
    detalhes: pgDetalhes,
  });

  // 2. Redis / BullMQ (HU-17)
  const redisOk = await pingRedis();
  itens.push({
    servico: 'Redis / BullMQ (HU-17)',
    configurado: Boolean(env.REDIS_URL || env.REDIS_HOST),
    conectado: redisOk,
    modo: env.REDIS_URL ? 'url' : `${env.REDIS_HOST}:${env.REDIS_PORT}`,
    detalhes: redisOk
      ? [`PONG recebido na fila "${env.NOTIFICATION_QUEUE_NAME}".`]
      : ['Redis inacessível no momento (verifique serviço Redis no WSL2 Ubuntu ou REDIS_URL).'],
  });

  // 3. Criptografia AES-256-GCM Chave Pix Artesãos
  const pixCryptoValida = Boolean(env.PIX_ENCRYPTION_KEY && isValidAes256KeyMaterial(env.PIX_ENCRYPTION_KEY));
  itens.push({
    servico: 'PIX_ENCRYPTION_KEY (AES-256)',
    configurado: pixCryptoValida,
    conectado: null,
    modo: env.NODE_ENV,
    detalhes: pixCryptoValida
      ? ['Material criptográfico AES-256 válido (32 bytes).']
      : ['Variável PIX_ENCRYPTION_KEY ausente ou inválida (obrigatória em produção).'],
  });

  // 4. Storage de Fotos
  const driverFotos = resolverDriverFotos();
  itens.push({
    servico: 'Armazenamento de Fotos',
    configurado:
      driverFotos === 'local' || Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    conectado: null,
    modo: driverFotos,
    detalhes:
      driverFotos === 'supabase'
        ? [`Bucket "${env.SUPABASE_STORAGE_BUCKET_FOTOS}" configurado com Supabase Storage.`]
        : driverFotos === 'local'
          ? ['Driver local ativo (desenvolvimento em disco).']
          : [
              'Não configurado (`FOTOS_STORAGE_DRIVER=local` ou `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`): upload de fotos opera fail-closed (HTTP 503).',
            ],
  });

  // 5. E-mail Transacional (HU-17)
  const emailVal = validarConfiguracaoProvedorEmail();
  const smtpCheck = emailVal.configurado && emailVal.provider === 'smtp' ? await verificarSmtpSeAtivo() : null;
  itens.push({
    servico: 'E-mail Transacional (HU-17)',
    configurado: emailVal.configurado,
    conectado: smtpCheck ? smtpCheck.verificado : null,
    modo: emailVal.provider,
    detalhes: [
      ...emailVal.erros,
      ...(smtpCheck?.erro ? [smtpCheck.erro] : []),
      ...(smtpCheck?.verificado ? ['Handshake SMTP verificado com sucesso.'] : []),
      ...(!emailVal.configurado && emailVal.erros.length === 0
        ? ['Desabilitado (`EMAIL_PROVIDER=disabled`): nenhum e-mail externo será enviado.']
        : []),
    ],
  });

  // 6. WhatsApp Business (HU-17)
  const waVal = validarConfiguracaoProvedorWhatsapp();
  itens.push({
    servico: 'WhatsApp Oficial (HU-17)',
    configurado: waVal.configurado,
    conectado: null,
    modo: waVal.provider,
    detalhes:
      waVal.erros.length > 0
        ? waVal.erros
        : waVal.configurado
          ? ['Credenciais preenchidas no ambiente.']
          : ['Desabilitado (`WHATSAPP_PROVIDER=disabled`).'],
  });

  // 7. Gateway de Pagamentos (HU-10)
  const pgtoVal = validarConfiguracaoGatewayPagamento();
  itens.push({
    servico: 'Gateway de Pagamentos (HU-10)',
    configurado: pgtoVal.configurado,
    conectado: null,
    modo: `${pgtoVal.gateway} (${pgtoVal.ambiente})`,
    detalhes:
      pgtoVal.erros.length > 0
        ? pgtoVal.erros
        : pgtoVal.configurado
          ? ['Credenciais mínimas configuradas; execute fumaça controlada no sandbox oficial.']
          : ['Desabilitado (`PAYMENT_GATEWAY=disabled`): checkout opera fail-closed (HTTP 503).'],
  });

  // 8. Cotação de Frete Multi-Origem (ADR-001 / HU-10)
  const freteVal = validarConfiguracaoProvedorFrete();
  itens.push({
    servico: 'Cotação de Frete Multi-Origem',
    configurado: freteVal.configurado,
    conectado: null,
    modo: freteVal.provider,
    detalhes:
      freteVal.erros.length > 0
        ? freteVal.erros
        : freteVal.configurado
          ? ['Endpoint HTTP de frete configurado.']
          : ['Desabilitado (`FRETE_PROVIDER=disabled`): cotação opera fail-closed (HTTP 503).'],
  });

  console.log(JSON.stringify({ timestamp: new Date().toISOString(), integracoes: itens }, null, 2));
}

main()
  .catch((err) => {
    console.error('Erro ao executar diagnóstico de integrações:', sanitizarErroProvedor(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
