-- Domain invariants not expressible in the Prisma schema language.
ALTER TABLE "courses"
  ADD CONSTRAINT "courses_title_nonempty_check" CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  ADD CONSTRAINT "courses_slug_format_check" CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug) <= 200),
  ADD CONSTRAINT "courses_description_nonempty_check" CHECK (length(btrim(description)) BETWEEN 1 AND 20000),
  ADD CONSTRAINT "courses_lifecycle_timestamps_check" CHECK (
    (status = 'DRAFT' AND published_at IS NULL AND archived_at IS NULL) OR
    (status = 'PUBLISHED' AND published_at IS NOT NULL AND archived_at IS NULL) OR
    (status = 'ARCHIVED' AND archived_at IS NOT NULL)
  );

ALTER TABLE "course_sections"
  ADD CONSTRAINT "course_sections_title_nonempty_check" CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  ADD CONSTRAINT "course_sections_sort_order_check" CHECK (sort_order >= 0);

ALTER TABLE "lessons"
  ADD CONSTRAINT "lessons_title_nonempty_check" CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  ADD CONSTRAINT "lessons_sort_order_check" CHECK (sort_order >= 0),
  ADD CONSTRAINT "lessons_content_type_check" CHECK (
    (type = 'TEXT' AND text_content IS NOT NULL AND length(btrim(text_content)) > 0) OR
    (type = 'VIDEO' AND text_content IS NULL)
  );

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_access_window_check" CHECK (expires_at IS NULL OR expires_at > starts_at),
  ADD CONSTRAINT "enrollments_revocation_check" CHECK (
    (status = 'REVOKED' AND revoked_at IS NOT NULL) OR
    (status <> 'REVOKED' AND revoked_at IS NULL)
  );

ALTER TABLE "lesson_progress"
  ADD CONSTRAINT "lesson_progress_nonnegative_check" CHECK (
    last_position_seconds >= 0 AND maximum_position_seconds >= 0 AND watched_seconds >= 0
  ),
  ADD CONSTRAINT "lesson_progress_maximum_check" CHECK (maximum_position_seconds >= last_position_seconds),
  ADD CONSTRAINT "lesson_progress_percentage_check" CHECK (percentage BETWEEN 0 AND 100);
