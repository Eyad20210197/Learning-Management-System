import type { ConfigService } from '@nestjs/config';
import { Email, User, type SessionPrincipal } from '@lms/identity';
import type {
  CourseAccessService,
  LearningRepositoryPort,
} from '@lms/learning';
import type {
  MediaLeasePort,
  PlaybackLockPort,
  PlaybackRepositoryPort,
} from '../index';
import type { PlaybackSessionView } from '../../domain';
import {
  CreatePlaybackSessionUseCase,
  HeartbeatPlaybackSessionUseCase,
  IssueMediaLeaseUseCase,
} from './playback.use-cases';

const principal: SessionPrincipal = {
  user: new User({
    id: 'user-id',
    email: Email.create('student@example.com'),
    firstName: 'Student',
    lastName: 'One',
    status: 'ACTIVE',
    roles: ['STUDENT'],
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  sessionId: 'auth-session-id',
  deviceId: 'device-id',
  permissions: [],
};

const session = (status: PlaybackSessionView['status'] = 'ACTIVE') => ({
  id: 'playback-id',
  userId: 'user-id',
  lessonId: 'lesson-id',
  videoId: 'video-id',
  deviceId: 'device-id',
  authSessionId: 'auth-session-id',
  status,
  sessionCode: 'CODE',
  startedAt: new Date(),
  lastHeartbeatAt: new Date(),
  endedAt: null,
  lastPositionSeconds: 12,
});

const config = {
  getOrThrow: jest.fn((key: string) =>
    key === 'playback.heartbeatIntervalSeconds' ? 30 : 120,
  ),
} as unknown as ConfigService;

describe('playback use cases', () => {
  it('authorizes with CourseAccessService then creates and publishes a single-stream lock', async () => {
    const createReplacingSession = jest.fn().mockResolvedValue(session());
    const replace = jest.fn().mockResolvedValue('old-session');
    const assertAccess = jest.fn();
    const repository = {
      findPlaybackSource: jest.fn().mockResolvedValue({
        lessonId: 'lesson-id',
        videoId: 'video-id',
        resumePositionSeconds: 12,
      }),
      createReplacingSession,
      findOwnedSession: jest.fn().mockResolvedValue(session()),
    } as unknown as PlaybackRepositoryPort;
    const lock = { replace } as unknown as PlaybackLockPort;
    const learning = {
      getEnrollmentForLesson: jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        startsAt: new Date(0),
        expiresAt: null,
      }),
    } as unknown as LearningRepositoryPort;
    const access = { assertAccess } as unknown as CourseAccessService;
    const useCase = new CreatePlaybackSessionUseCase(
      repository,
      lock,
      learning,
      access,
      config,
    );

    await expect(
      useCase.execute({ principal, lessonId: 'lesson-id' }),
    ).resolves.toMatchObject({
      hlsUrl: '/media/hls/video-id/master.m3u8',
      heartbeatIntervalSeconds: 30,
    });
    expect(assertAccess).toHaveBeenCalledTimes(1);
    expect(createReplacingSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        lastPositionSeconds: 12,
      }),
    );
    expect(replace).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({ sessionId: 'playback-id' }),
    );
  });

  it('returns PLAYBACK_REPLACED without issuing a renewed lease', async () => {
    const issue = jest.fn();
    const repository = {
      findOwnedSession: jest.fn().mockResolvedValue(session('REPLACED')),
    } as unknown as PlaybackRepositoryPort;
    const lock = { isCurrent: jest.fn() } as unknown as PlaybackLockPort;
    const leases = { issue } as unknown as MediaLeasePort;
    const useCase = new HeartbeatPlaybackSessionUseCase(
      repository,
      lock,
      leases,
      config,
    );

    await expect(
      useCase.execute({
        principal,
        sessionId: 'playback-id',
        positionSeconds: 30,
      }),
    ).rejects.toMatchObject({ code: 'PLAYBACK_REPLACED' });
    expect(issue).not.toHaveBeenCalled();
  });

  it('repairs Redis to the database winner when concurrent starts publish out of order', async () => {
    const winner = {
      ...session(),
      id: 'newer-playback-id',
      deviceId: 'newer-device-id',
    };
    const replace = jest.fn().mockResolvedValue(null);
    const release = jest.fn().mockResolvedValue(undefined);
    const repository = {
      findPlaybackSource: jest.fn().mockResolvedValue({
        lessonId: 'lesson-id',
        videoId: 'video-id',
        resumePositionSeconds: 0,
      }),
      createReplacingSession: jest.fn().mockResolvedValue(session()),
      findOwnedSession: jest.fn().mockResolvedValue(session('REPLACED')),
      findActiveSession: jest.fn().mockResolvedValue(winner),
    } as unknown as PlaybackRepositoryPort;
    const lock = { replace, release } as unknown as PlaybackLockPort;
    const learning = {
      getEnrollmentForLesson: jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        startsAt: new Date(0),
        expiresAt: null,
      }),
    } as unknown as LearningRepositoryPort;
    const useCase = new CreatePlaybackSessionUseCase(
      repository,
      lock,
      learning,
      { assertAccess: jest.fn() },
      config,
    );

    await expect(
      useCase.execute({ principal, lessonId: 'lesson-id' }),
    ).rejects.toMatchObject({ code: 'PLAYBACK_REPLACED' });
    expect(release).toHaveBeenCalledWith('user-id', 'playback-id');
    expect(replace).toHaveBeenLastCalledWith(
      'user-id',
      expect.objectContaining({ sessionId: 'newer-playback-id' }),
    );
  });

  it('refuses lease issuance when Redis no longer names the session current', async () => {
    const issue = jest.fn();
    const repository = {
      findOwnedSession: jest.fn().mockResolvedValue(session()),
    } as unknown as PlaybackRepositoryPort;
    const lock = {
      isCurrent: jest.fn().mockResolvedValue(false),
    } as unknown as PlaybackLockPort;
    const leases = { issue } as unknown as MediaLeasePort;
    const useCase = new IssueMediaLeaseUseCase(leases, repository, lock);

    await expect(
      useCase.execute(principal, 'playback-id'),
    ).rejects.toMatchObject({
      code: 'PLAYBACK_REVOKED',
    });
    expect(issue).not.toHaveBeenCalled();
  });

  it('persists revocation and releases Redis when account access is revoked', async () => {
    const transitionActive = jest.fn().mockResolvedValue(true);
    const release = jest.fn().mockResolvedValue(undefined);
    const repository = {
      findOwnedSession: jest.fn().mockResolvedValue(session()),
      heartbeat: jest.fn().mockResolvedValue(null),
      transitionActive,
    } as unknown as PlaybackRepositoryPort;
    const lock = {
      isCurrent: jest.fn().mockResolvedValue(true),
      release,
    } as unknown as PlaybackLockPort;
    const useCase = new HeartbeatPlaybackSessionUseCase(
      repository,
      lock,
      { issue: jest.fn() },
      config,
    );

    await expect(
      useCase.execute({
        principal,
        sessionId: 'playback-id',
        positionSeconds: 30,
      }),
    ).rejects.toMatchObject({ code: 'PLAYBACK_REVOKED' });
    expect(transitionActive).toHaveBeenCalledWith(
      'playback-id',
      'REVOKED',
      expect.any(Date),
    );
    expect(release).toHaveBeenCalledWith('user-id', 'playback-id');
  });
});
