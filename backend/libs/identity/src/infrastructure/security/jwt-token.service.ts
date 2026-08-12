import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  AccessTokenSubject,
  IssuedAccessToken,
  TokenServicePort,
} from '../../application';
import { AccessTokenInvalidError } from '../../domain';

interface AccessClaims {
  sub: string;
  sid: string;
  did: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class JwtTokenService implements TokenServicePort {
  private readonly accessSecret: string;
  private readonly accessTtl: number;
  private readonly refreshSecret: string;
  private readonly refreshTtl: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('app.jwtAccessSecret');
    this.accessTtl = config.getOrThrow<number>('app.jwtAccessTtlSeconds');
    this.refreshSecret = config.getOrThrow<string>('app.refreshTokenSecret');
    this.refreshTtl = config.getOrThrow<number>('app.refreshTokenTtlSeconds');
  }

  async issueAccessToken(
    subject: AccessTokenSubject,
  ): Promise<IssuedAccessToken> {
    const value = await this.jwt.signAsync(
      {
        sid: subject.sessionId,
        did: subject.deviceId,
        roles: [...subject.roles],
        permissions: [...subject.permissions],
      },
      {
        subject: subject.userId,
        secret: this.accessSecret,
        expiresIn: this.accessTtl,
        algorithm: 'HS256',
      },
    );
    return { value, expiresInSeconds: this.accessTtl };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenSubject> {
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        secret: this.accessSecret,
        algorithms: ['HS256'],
      });
      if (
        !claims.sub ||
        !claims.sid ||
        !claims.did ||
        !Array.isArray(claims.roles) ||
        !Array.isArray(claims.permissions)
      ) {
        throw new AccessTokenInvalidError();
      }
      return {
        userId: claims.sub,
        sessionId: claims.sid,
        deviceId: claims.did,
        roles: claims.roles,
        permissions: claims.permissions,
      };
    } catch {
      throw new AccessTokenInvalidError();
    }
  }

  issueRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }
  hashRefreshToken(token: string): string {
    return createHmac('sha256', this.refreshSecret).update(token).digest('hex');
  }
  refreshTokenExpiresAt(): Date {
    return new Date(Date.now() + this.refreshTtl * 1000);
  }
}
