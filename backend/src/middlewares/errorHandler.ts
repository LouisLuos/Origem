import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      erro: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    const mensagens = err.issues.map((i) => i.message).join('; ');
    res.status(400).json({
      erro: `Dados inválidos: ${mensagens}`,
    });
    return;
  }

  console.error('❌ Erro inesperado capturado pelo errorHandler:', err);

  res.status(500).json({
    erro: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
  });
}
