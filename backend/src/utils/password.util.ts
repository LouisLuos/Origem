import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../repositories/contracts/authentication.contracts.js';

const BCRYPT_ROUNDS = 12;

export const passwordHasher: PasswordHasher = {
  hash(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  },
  verify(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  },
};
