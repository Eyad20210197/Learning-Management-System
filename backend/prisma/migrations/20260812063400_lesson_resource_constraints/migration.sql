ALTER TABLE "lesson_resources"
  ADD CONSTRAINT "lesson_resources_title_not_blank" CHECK (length(btrim("title")) > 0),
  ADD CONSTRAINT "lesson_resources_storage_key_not_blank" CHECK (length(btrim("storage_key")) > 0),
  ADD CONSTRAINT "lesson_resources_mime_type_not_blank" CHECK (length(btrim("mime_type")) > 0),
  ADD CONSTRAINT "lesson_resources_size_positive" CHECK ("size_bytes" > 0);
