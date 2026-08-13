import { createPublicKey, verify } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { Es256MediaLeaseAdapter } from './es256-media-lease.adapter';

const PRIVATE_KEY =
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg3+KCBV/mzosPlk5cTQsGUZZ4syCh7c/C+I1u78VFVKahRANCAAT967LPcEyQPMC8KVQ0t7fw+rRRuZExD/yphak61u5ri93sBPguiaVz/7RJvOb676d1rPLl0tXTWf3MACDUQqDo';
const PUBLIC_KEY =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/euyz3BMkDzAvClUNLe38Pq0UbmRMQ/8qYWpOtbua4vd7AT4Lomlc/+0Sbzm+u+ndazy5dLV01n9zAAg1EKg6A==';

describe('Es256MediaLeaseAdapter', () => {
  it('issues a verifiable narrow 90-second ES256 lease', async () => {
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'playback.leasePrivateKey' ? PRIVATE_KEY : 90,
      ),
    } as unknown as ConfigService;
    const adapter = new Es256MediaLeaseAdapter(config);
    const issued = await adapter.issue({
      sessionId: 'session-id',
      userId: 'user-id',
      deviceId: 'device-id',
      videoId: 'video-id',
    });
    const [header, payload, signature] = issued.token.split('.');
    const claims = JSON.parse(
      Buffer.from(payload ?? '', 'base64url').toString(),
    ) as Record<string, unknown>;

    expect(claims).toMatchObject({
      sid: 'session-id',
      sub: 'user-id',
      did: 'device-id',
      vid: 'video-id',
      aud: 'lms-media',
    });
    expect((claims.exp as number) - (claims.iat as number)).toBe(90);
    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${payload}`),
        {
          key: createPublicKey({
            key: Buffer.from(PUBLIC_KEY, 'base64'),
            format: 'der',
            type: 'spki',
          }),
          dsaEncoding: 'ieee-p1363',
        },
        Buffer.from(signature ?? '', 'base64url'),
      ),
    ).toBe(true);
  });
});
