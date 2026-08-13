import { SensitiveMetadataSanitizer } from './sensitive-metadata-sanitizer';

describe('SensitiveMetadataSanitizer', () => {
  const sanitizer = new SensitiveMetadataSanitizer();

  it('recursively redacts credentials and signed URLs from operational views', () => {
    expect(
      sanitizer.sanitize({
        safe: 'retained',
        accessToken: 'secret',
        nested: {
          storage_key: 'private/object',
          links: [
            'https://storage.test/object?signature=secret',
            '/relative/path',
          ],
        },
      }),
    ).toEqual({
      safe: 'retained',
      accessToken: '[REDACTED]',
      nested: {
        storage_key: '[REDACTED]',
        links: ['[REDACTED_URL]', '/relative/path'],
      },
    });
  });
});
