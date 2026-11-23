import type { Request, Response } from 'express';

export class HealthController {
  public static check(req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      servico: 'origem-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
}
