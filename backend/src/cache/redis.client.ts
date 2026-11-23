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

interface ParsedRedisBaseOptions {
  readonly host: string;
  readonly port: number;
  readonly username?: string;
  readonly password?: string;
  readonly db: number;
  readonly tls?: Record<string, unknown>;
}

function buildBaseRedisOptions(config?: RedisConfigInput): ParsedRedisBaseOptions {
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
    };
  }

  return {
    host: config?.host ?? env.REDIS_HOST,
    port: config?.port ?? env.REDIS_PORT,
    password: config?.password ?? env.REDIS_PASSWORD,
    db: config?.db ?? env.REDIS_DB,
  };
}

/**
 * Opções de conexão fail-fast para produtores/`Queue` BullMQ (não bloqueia a API se o Redis cair — RNF-12).
 */
export function createBullMqQueueConnectionOptions(config?: RedisConfigInput): ConnectionOptions {
  return {
    ...buildBaseRedisOptions(config),
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
    connectTimeout: 3000,
    retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
  };
}

/**
 * Opções de conexão dedicadas ao `Worker` BullMQ (exige `maxRetriesPerRequest: null` para comandos bloqueantes).
 */
export function createBullMqWorkerConnectionOptions(config?: RedisConfigInput): ConnectionOptions {
  return {
    ...buildBaseRedisOptions(config),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/** Alias preservado para compatibilidade; aponta para as opções do Worker. */
export const createBullMqConnectionOptions = createBullMqWorkerConnectionOptions;

/**
 * Cria cliente ioredis dedicado para diagnósticos ou limpeza controlada de testes.
 */
export function createRedisDiagnosticClient(config?: RedisConfigInput): Redis {
  const base = buildBaseRedisOptions(config);

  return new Redis({
    host: base.host,
    port: base.port,
    username: base.username,
    password: base.password,
    db: base.db,
    tls: base.tls,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: () => null,
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
