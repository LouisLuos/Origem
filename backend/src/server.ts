import { app } from './app.js';
import { prisma } from './config/database.js';
import { env } from './config/env.js';
import { iniciarAgendadorExpiracaoReservas } from './services/reservaExpiracao.scheduler.js';

const agendadorReservas = iniciarAgendadorExpiracaoReservas();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Servidor backend Origem ativo em http://localhost:${env.PORT}`);
  console.log(`📡 Endpoints base disponíveis em http://localhost:${env.PORT}/api/v1`);
  console.log(`🩺 Health check disponível em http://localhost:${env.PORT}/api/v1/health`);
});

let encerrando = false;

// Tratamento de sinais de encerramento gracioso (Graceful Shutdown)
function handleShutdown(signal: string): void {
  if (encerrando) return;
  encerrando = true;

  console.log(`\n🛑 Sinal ${signal} recebido. Encerrando servidor HTTP e conexões com PostgreSQL...`);
  agendadorReservas.parar();

  const forceTimer = setTimeout(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  }, 5000);
  forceTimer.unref?.();

  server.close(() => {
    clearTimeout(forceTimer);
    void prisma
      .$disconnect()
      .catch(() => {})
      .finally(() => {
        console.log('✅ Servidor HTTP e Prisma encerrados com sucesso.');
        process.exit(0);
      });
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
