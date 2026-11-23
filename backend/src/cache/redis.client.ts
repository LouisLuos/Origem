import type { ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export interface RedisConfigInput {
  readonly redisUrl?: string;
  readonly host?: string;
  readonly port?: number;
  readonly password?: string;
  readonly db?: number;
}

/**
 * Converte configuração de ambiente em `ConnectionOptions` compatível com BullMQ v6.
 * Não define `keyPrefix` na conexão porque BullMQ utiliza sua opção própria `prefix`.
 */
export function createBullMqConnectionOptions(config?: RedisConfigInput): ConnectionOptions {
  const url = config?.redisUrl ?? env.REDIS_URL;

  if (url) {
    const parsed = new URL(url);
    const dbSegment = parsed.pathname.replace(/^\//, '').trim();
    const dbParsed = dbSegment ? Number.parseInt(dbSegment, 10) : 0;

    return {
      host: parsed.hostname,
      port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: Number.isInteger(dbParsed) && dbParsed >= 0 ? dbParsed : 0,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  return {
    host: config?.host ?? env.REDIS_HOST,
    port: config?.port ?? env.REDIS_PORT,
    password: config?.password ?? env.REDIS_PASSWORD,
    db: config?.db ?? env.REDIS_DB,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/**
 * Cria cliente ioredis dedicado para diagnósticos ou limpeza controlada de testes.
 */
export function createRedisDiagnosticClient(config?: RedisConfigInput): Redis {
  const opts = createBullMqConnectionOptions(config) as {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    db?: number;
    tls?: Record<string, unknown>;
  };

  return new Redis({
    host: opts.host,
    port: opts.port,
    username: opts.username,
    password: opts.password,
    db: opts.db,
    tls: opts.tls,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });
}

export async function pingRedis(config?: RedisConfigInput): Promise<boolean> {
  const client = createRedisDiagnosticClient(config);
  try {
    await client.connect();
    const resposta = await client.ping();
    return resposta === 'PONG';
  } catch {
    return false;
  } finally {
    await client.quit().catch(() => {
      client.disconnect();
    });
  }
}
