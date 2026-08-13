import { createPrivateKey, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMediaLease } from './lease';

const PRIVATE_KEY =
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg3+KCBV/mzosPlk5cTQsGUZZ4syCh7c/C+I1u78VFVKahRANCAAT967LPcEyQPMC8KVQ0t7fw+rRRuZExD/yphak61u5ri93sBPguiaVz/7RJvOb676d1rPLl0tXTWf3MACDUQqDo';
const PUBLIC_KEY =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/euyz3BMkDzAvClUNLe38Pq0UbmRMQ/8qYWpOtbua4vd7AT4Lomlc/+0Sbzm+u+ndazy5dLV01n9zAAg1EKg6A==';
const VIDEO_ID = '0198d03a-81df-7c0f-9908-e700c1c6744d';

const token = (overrides: Record<string, unknown> = {}): string => {
  const now = 1_800_000_000;
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'ES256', typ: 'JWT', kid: 'v1' });
  const payload = encode({
    sid: 'session',
    sub: 'user',
    did: 'device',
    vid: VIDEO_ID,
    aud: 'lms-media',
    iat: now,
    exp: now + 90,
    jti: 'token',
    ...overrides,
  });
  const data = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(data), {
    key: createPrivateKey({
      key: Buffer.from(PRIVATE_KEY, 'base64'),
      format: 'der',
      type: 'pkcs8',
    }),
    dsaEncoding: 'ieee-p1363',
  });
  return `${data}.${Buffer.from(signature).toString('base64url')}`;
};

describe('verifyMediaLease', () => {
  it('accepts a valid narrow ES256 lease', async () => {
    await expect(
      verifyMediaLease(token(), PUBLIC_KEY, VIDEO_ID, 1_800_000_001),
    ).resolves.toMatchObject({ vid: VIDEO_ID, aud: 'lms-media' });
  });

  it('rejects expiry, another video, and a modified signature', async () => {
    await expect(
      verifyMediaLease(token({ exp: 1_799_999_999 }), PUBLIC_KEY, VIDEO_ID, 1_800_000_000),
    ).resolves.toBeNull();
    await expect(
      verifyMediaLease(token(), PUBLIC_KEY, '0198d03a-81df-7c0f-9908-e700c1c6744e', 1_800_000_001),
    ).resolves.toBeNull();
    const signed = token();
    const segments = signed.split('.');
    const signature = segments[2] ?? '';
    const modified = `${segments[0]}.${segments[1]}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    await expect(
      verifyMediaLease(modified, PUBLIC_KEY, VIDEO_ID, 1_800_000_001),
    ).resolves.toBeNull();
  });
});
