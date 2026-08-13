import { DomainError } from '@lms/shared-kernel';

export class PlaybackUnavailableError extends DomainError {
  constructor(message = 'No ready active video is available for this lesson.') {
    super('PLAYBACK_UNAVAILABLE', message);
  }
}

export class PlaybackSessionNotFoundError extends DomainError {
  constructor() {
    super('PLAYBACK_SESSION_NOT_FOUND', 'Playback session was not found.');
  }
}

export class PlaybackReplacedError extends DomainError {
  constructor() {
    super('PLAYBACK_REPLACED', 'Playback was replaced by a newer stream.');
  }
}

export class PlaybackRevokedError extends DomainError {
  constructor() {
    super('PLAYBACK_REVOKED', 'Playback access was revoked.');
  }
}

export class PlaybackEndedError extends DomainError {
  constructor() {
    super('PLAYBACK_ENDED', 'Playback session has ended.');
  }
}
