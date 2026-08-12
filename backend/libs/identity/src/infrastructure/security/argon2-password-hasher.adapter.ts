import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { PasswordHasherPort } from '../../application';

@Injectable()
export class Argon2PasswordHasherAdapter implements PasswordHasherPort {
  hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  verify(hash: string, plainText: string): Promise<boolean> {
    return argon2.verify(hash, plainText);
  }
}
