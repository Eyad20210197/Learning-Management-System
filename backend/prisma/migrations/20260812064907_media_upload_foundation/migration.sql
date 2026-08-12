-- CreateEnum
CREATE TYPE "video_status" AS ENUM ('UPLOADING', 'UPLOADED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', 'DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "upload_status" AS ENUM ('PENDING', 'UPLOADING', 'COMPLETED', 'EXPIRED', 'ABORTED');

-- CreateEnum
CREATE TYPE "video_asset_type" AS ENUM ('SOURCE', 'HLS_MASTER', 'THUMBNAIL', 'CAPTION');

-- CreateEnum
CREATE TYPE "video_variant_status" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "processing_job_status" AS ENUM ('QUEUED', 'ACTIVE', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" "video_status" NOT NULL DEFAULT 'UPLOADING',
    "source_filename" TEXT NOT NULL,
    "source_size_bytes" BIGINT NOT NULL,
    "duration_seconds" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "video_codec" TEXT,
    "audio_codec" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "processing_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "type" "video_asset_type" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_variants" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "status" "video_variant_status" NOT NULL DEFAULT 'PENDING',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bitrate_kbps" INTEGER NOT NULL,
    "video_codec" TEXT NOT NULL,
    "audio_codec" TEXT NOT NULL,
    "playlist_key" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "video_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_uploads" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "initiated_by_user_id" UUID NOT NULL,
    "status" "upload_status" NOT NULL DEFAULT 'PENDING',
    "storage_key" TEXT NOT NULL,
    "provider_upload_id" TEXT,
    "expected_size_bytes" BIGINT NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "video_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_processing_jobs" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "queue_job_id" TEXT,
    "status" "processing_job_status" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "video_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "videos_lesson_id_status_created_at_idx" ON "videos"("lesson_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "videos_status_created_at_idx" ON "videos"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "video_assets_storage_key_key" ON "video_assets"("storage_key");

-- CreateIndex
CREATE INDEX "video_assets_video_id_type_idx" ON "video_assets"("video_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "video_variants_playlist_key_key" ON "video_variants"("playlist_key");

-- CreateIndex
CREATE UNIQUE INDEX "video_variants_video_id_height_key" ON "video_variants"("video_id", "height");

-- CreateIndex
CREATE UNIQUE INDEX "video_uploads_storage_key_key" ON "video_uploads"("storage_key");

-- CreateIndex
CREATE INDEX "video_uploads_video_id_status_idx" ON "video_uploads"("video_id", "status");

-- CreateIndex
CREATE INDEX "video_uploads_initiated_by_user_id_created_at_idx" ON "video_uploads"("initiated_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "video_uploads_status_expires_at_idx" ON "video_uploads"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "video_processing_jobs_queue_job_id_key" ON "video_processing_jobs"("queue_job_id");

-- CreateIndex
CREATE INDEX "video_processing_jobs_video_id_created_at_idx" ON "video_processing_jobs"("video_id", "created_at");

-- CreateIndex
CREATE INDEX "video_processing_jobs_status_created_at_idx" ON "video_processing_jobs"("status", "created_at");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_variants" ADD CONSTRAINT "video_variants_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_uploads" ADD CONSTRAINT "video_uploads_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_uploads" ADD CONSTRAINT "video_uploads_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_processing_jobs" ADD CONSTRAINT "video_processing_jobs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
