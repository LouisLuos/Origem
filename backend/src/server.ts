import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Servidor backend Origem ativo em http://localhost:${env.PORT}`);
  console.log(`📡 Endpoints base disponíveis em http://localhost:${env.PORT}/api/v1`);
  console.log(`🩺 Health check disponível em http://localhost:${env.PORT}/api/v1/health`);
});

// Tratamento de sinais de encerramento gracioso (Graceful Shutdown)
function handleShutdown(signal: string) {
  console.log(`\n🛑 Sinal ${signal} recebido. Encerrando servidor HTTP graciosamente...`);
  server.close(() => {
    console.log('✅ Servidor HTTP encerrado com sucesso.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
