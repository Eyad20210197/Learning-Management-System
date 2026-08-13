import { Injectable } from '@nestjs/common';

const SENSITIVE_KEY =
  /(password|secret|token|authorization|cookie|storage.?key|signed.?url|upload.?url|media.?lease|credential)/i;

@Injectable()
export class SensitiveMetadataSanitizer {
  sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          SENSITIVE_KEY.test(key) ? '[REDACTED]' : this.sanitize(item),
        ]),
      );
    }
    if (
      typeof value === 'string' &&
      /^https?:\/\//i.test(value) &&
      value.includes('?')
    ) {
      return '[REDACTED_URL]';
    }
    return value;
  }
}
