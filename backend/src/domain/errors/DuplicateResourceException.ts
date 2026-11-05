import { DomainError } from './DomainError'

export class DuplicateResourceException extends DomainError {
  constructor(message: string) {
    super(message, 'DUPLICATE_RESOURCE', 409)
  }
}

