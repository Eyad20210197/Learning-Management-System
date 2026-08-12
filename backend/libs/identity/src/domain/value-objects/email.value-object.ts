import { InvalidEmailError } from '../errors/invalid-email.error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    const normalized = value.trim().toLowerCase();

    if (
      normalized.length < 3 ||
      normalized.length > 320 ||
      !EMAIL_PATTERN.test(normalized)
    ) {
      throw new InvalidEmailError();
    }

    return new Email(normalized);
  }
}
