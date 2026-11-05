/**
 * Classe base para exceções da Camada de Domínio (Clean Architecture - RNF-04).
 * Zero acoplamento com frameworks HTTP ou ORMs.
 */
export class DomainError extends Error {
  public readonly code: string
  public readonly suggestedHttpStatus: number

  constructor(message: string, code: string, suggestedHttpStatus = 400) {
    super(message)
    this.name = new.target.name
    this.code = code
    this.suggestedHttpStatus = suggestedHttpStatus
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

