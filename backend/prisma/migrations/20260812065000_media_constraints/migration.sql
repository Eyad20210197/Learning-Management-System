ALTER TABLE "videos"
  ADD CONSTRAINT "videos_source_filename_not_blank" CHECK (length(btrim("source_filename")) > 0),
  ADD CONSTRAINT "videos_source_size_positive" CHECK ("source_size_bytes" > 0),
  ADD CONSTRAINT "videos_duration_nonnegative" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
  ADD CONSTRAINT "videos_dimensions_positive" CHECK (("width" IS NULL AND "height" IS NULL) OR ("width" > 0 AND "height" > 0));

CREATE UNIQUE INDEX "videos_one_current_per_lesson"
  ON "videos" ("lesson_id") WHERE "is_current" = true;

ALTER TABLE "video_assets"
  ADD CONSTRAINT "video_assets_storage_key_not_blank" CHECK (length(btrim("storage_key")) > 0),
  ADD CONSTRAINT "video_assets_mime_type_not_blank" CHECK (length(btrim("mime_type")) > 0),
  ADD CONSTRAINT "video_assets_size_positive" CHECK ("size_bytes" > 0);

ALTER TABLE "video_variants"
  ADD CONSTRAINT "video_variants_dimensions_positive" CHECK ("width" > 0 AND "height" > 0),
  ADD CONSTRAINT "video_variants_bitrate_positive" CHECK ("bitrate_kbps" > 0),
  ADD CONSTRAINT "video_variants_playlist_key_not_blank" CHECK (length(btrim("playlist_key")) > 0),
  ADD CONSTRAINT "video_variants_size_positive" CHECK ("size_bytes" IS NULL OR "size_bytes" > 0);

ALTER TABLE "video_uploads"
  ADD CONSTRAINT "video_uploads_storage_key_not_blank" CHECK (length(btrim("storage_key")) > 0),
  ADD CONSTRAINT "video_uploads_expected_size_positive" CHECK ("expected_size_bytes" > 0),
  ADD CONSTRAINT "video_uploads_completion_consistent" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));

ALTER TABLE "video_processing_jobs"
  ADD CONSTRAINT "video_processing_jobs_attempt_nonnegative" CHECK ("attempt" >= 0);
