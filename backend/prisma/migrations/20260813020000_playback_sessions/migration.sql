CREATE TYPE "playback_session_status" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED', 'REVOKED', 'REPLACED');

CREATE TABLE "playback_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "video_id" UUID NOT NULL,
  "device_id" UUID NOT NULL,
  "auth_session_id" UUID NOT NULL,
  "status" "playback_session_status" NOT NULL DEFAULT 'ACTIVE',
  "session_code" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_heartbeat_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  "last_position_seconds" INTEGER NOT NULL DEFAULT 0,
  "ip_address" INET,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "playback_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "playback_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "playback_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "playback_sessions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "playback_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "playback_sessions_auth_session_id_fkey" FOREIGN KEY ("auth_session_id") REFERENCES "auth_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "playback_sessions_session_code_key" ON "playback_sessions"("session_code");
CREATE INDEX "playback_sessions_user_id_status_last_heartbeat_at_idx" ON "playback_sessions"("user_id", "status", "last_heartbeat_at");
CREATE INDEX "playback_sessions_device_id_status_idx" ON "playback_sessions"("device_id", "status");
CREATE INDEX "playback_sessions_auth_session_id_status_idx" ON "playback_sessions"("auth_session_id", "status");
CREATE INDEX "playback_sessions_video_id_created_at_idx" ON "playback_sessions"("video_id", "created_at");
CREATE INDEX "playback_sessions_lesson_id_idx" ON "playback_sessions"("lesson_id");
CREATE UNIQUE INDEX "playback_sessions_one_active_per_user_idx" ON "playback_sessions"("user_id") WHERE "status" = 'ACTIVE';

CREATE TABLE "playback_events" (
  "id" UUID NOT NULL,
  "playback_session_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "position_seconds" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "playback_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "playback_events_playback_session_id_fkey" FOREIGN KEY ("playback_session_id") REFERENCES "playback_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "playback_events_playback_session_id_created_at_idx" ON "playback_events"("playback_session_id", "created_at");
CREATE INDEX "playback_events_event_type_created_at_idx" ON "playback_events"("event_type", "created_at");
