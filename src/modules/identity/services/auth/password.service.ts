import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hashes and verifies user passwords using argon2 — a slow, memory-hard
 * algorithm designed to resist brute-force attacks (unlike fast hashes such
 * as SHA-256/MD5, which are unsuitable for passwords).
 */
@Injectable()
export class PasswordService {
  async hash(rawPassword: string): Promise<string> {
    return argon2.hash(rawPassword);
  }

  async verify(passwordHash: string, rawPassword: string): Promise<boolean> {
    return argon2.verify(passwordHash, rawPassword);
  }
}
