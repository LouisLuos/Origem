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
      ...(err.code ? { codigo: err.code } : {}),
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

  // Log sanitizado: evita despejar objetos crus, payloads, tokens ou dados bancários
  if (err instanceof Error) {
    console.error('❌ Erro inesperado capturado pelo errorHandler:', {
      correlationId: req.correlationId ?? null,
      name: err.name,
      message: err.message,
    });
  } else {
    console.error('❌ Erro inesperado capturado pelo errorHandler:', {
      correlationId: req.correlationId ?? null,
      errorType: typeof err,
    });
  }

  res.status(500).json({
    erro: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
  });
}
