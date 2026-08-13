import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@lms/platform';
import type { ActivePlaybackState, PlaybackLockPort } from '../../application';

@Injectable()
export class RedisPlaybackLockAdapter implements PlaybackLockPort {
  private readonly prefix: string;
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.prefix = config.getOrThrow<string>('playback.redisPrefix');
    this.ttlSeconds = config.getOrThrow<number>('playback.staleAfterSeconds');
  }

  async replace(
    userId: string,
    state: ActivePlaybackState,
  ): Promise<string | null> {
    const activeKey = this.activeKey(userId);
    const sessionKey = this.sessionKey(state.sessionId);
    const value = JSON.stringify(state);
    const result = await this.redis.client.eval(
      `local previous = redis.call('GET', KEYS[1])
       if previous then
         local decoded = cjson.decode(previous)
         if decoded.sessionId ~= ARGV[4] then
           redis.call('DEL', ARGV[5] .. decoded.sessionId)
         end
       end
       redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
       redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])
       return previous`,
      2,
      activeKey,
      sessionKey,
      value,
      this.ttlSeconds.toString(),
      userId,
      state.sessionId,
      `${this.prefix}:session:`,
    );
    if (typeof result !== 'string') return null;
    return this.parseState(result)?.sessionId ?? null;
  }

  async isCurrent(
    userId: string,
    state: ActivePlaybackState,
  ): Promise<boolean> {
    return (
      (await this.redis.client.get(this.activeKey(userId))) ===
      JSON.stringify(state)
    );
  }

  async renew(userId: string, state: ActivePlaybackState): Promise<boolean> {
    const result = await this.redis.client.eval(
      `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
       redis.call('EXPIRE', KEYS[1], ARGV[2])
       redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])
       return 1`,
      2,
      this.activeKey(userId),
      this.sessionKey(state.sessionId),
      JSON.stringify(state),
      this.ttlSeconds.toString(),
      userId,
    );
    return result === 1;
  }

  async release(userId: string, sessionId: string): Promise<void> {
    await this.redis.client.eval(
      `local value = redis.call('GET', KEYS[1])
       if value then
         local decoded = cjson.decode(value)
         if decoded.sessionId == ARGV[1] then redis.call('DEL', KEYS[1]) end
       end
       redis.call('DEL', KEYS[2])
       return 1`,
      2,
      this.activeKey(userId),
      this.sessionKey(sessionId),
      sessionId,
    );
  }

  async removeSession(sessionId: string): Promise<void> {
    const sessionKey = this.sessionKey(sessionId);
    const userId = await this.redis.client.get(sessionKey);
    if (userId !== null) await this.release(userId, sessionId);
  }

  private activeKey(userId: string): string {
    return `${this.prefix}:user:${userId}`;
  }

  private sessionKey(sessionId: string): string {
    return `${this.prefix}:session:${sessionId}`;
  }

  private parseState(value: string): ActivePlaybackState | null {
    try {
      const parsed = JSON.parse(value) as Partial<ActivePlaybackState>;
      return typeof parsed.sessionId === 'string' &&
        typeof parsed.videoId === 'string' &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.authSessionId === 'string'
        ? (parsed as ActivePlaybackState)
        : null;
    } catch {
      return null;
    }
  }
}
