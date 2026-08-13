import {
  createPrivateKey,
  randomUUID,
  sign,
  type KeyObject,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IssuedMediaLease,
  MediaLeaseClaims,
  MediaLeasePort,
} from '../../application';

@Injectable()
export class Es256MediaLeaseAdapter implements MediaLeasePort {
  private readonly privateKey: KeyObject;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService) {
    this.privateKey = createPrivateKey({
      key: Buffer.from(
        config.getOrThrow<string>('playback.leasePrivateKey'),
        'base64',
      ),
      format: 'der',
      type: 'pkcs8',
    });
    this.ttlSeconds = config.getOrThrow<number>('playback.leaseTtlSeconds');
  }

  issue(input: {
    sessionId: string;
    userId: string;
    deviceId: string;
    videoId: string;
  }): Promise<IssuedMediaLease> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const claims: MediaLeaseClaims = {
      ...input,
      audience: 'lms-media',
      issuedAt,
      expiresAt: issuedAt + this.ttlSeconds,
      tokenId: randomUUID(),
    };
    const encodedHeader = this.encode({ alg: 'ES256', typ: 'JWT', kid: 'v1' });
    const encodedPayload = this.encode({
      sid: claims.sessionId,
      sub: claims.userId,
      did: claims.deviceId,
      vid: claims.videoId,
      aud: claims.audience,
      iat: claims.issuedAt,
      exp: claims.expiresAt,
      jti: claims.tokenId,
    });
    const signed = `${encodedHeader}.${encodedPayload}`;
    const signature = sign('sha256', Buffer.from(signed), {
      key: this.privateKey,
      dsaEncoding: 'ieee-p1363',
    });
    return Promise.resolve({
      token: `${signed}.${signature.toString('base64url')}`,
      expiresAt: new Date(claims.expiresAt * 1000),
    });
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
