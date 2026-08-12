-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants that Prisma's schema language cannot express.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalized_check"
  CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 320),
  ADD CONSTRAINT "users_names_nonempty_check"
  CHECK (length(btrim(first_name)) > 0 AND length(btrim(last_name)) > 0);

ALTER TABLE "roles"
  ADD CONSTRAINT "roles_name_nonempty_check" CHECK (length(btrim(name)) > 0);

ALTER TABLE "permissions"
  ADD CONSTRAINT "permissions_key_format_check"
  CHECK (key ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$');

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_name_nonempty_check" CHECK (length(btrim(name)) > 0);

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_expiry_check" CHECK (expires_at > created_at),
  ADD CONSTRAINT "refresh_tokens_parent_check" CHECK (parent_token_id IS NULL OR parent_token_id <> id);

ALTER TABLE "one_time_tokens"
  ADD CONSTRAINT "one_time_tokens_expiry_check" CHECK (expires_at > created_at);

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_action_nonempty_check" CHECK (length(btrim(action)) > 0),
  ADD CONSTRAINT "audit_logs_target_type_nonempty_check" CHECK (length(btrim(target_type)) > 0);

ALTER TABLE "security_events"
  ADD CONSTRAINT "security_events_type_nonempty_check" CHECK (length(btrim(type)) > 0);

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_scope_nonempty_check" CHECK (length(btrim(scope)) > 0),
  ADD CONSTRAINT "idempotency_keys_key_nonempty_check" CHECK (length(btrim(key)) BETWEEN 16 AND 128),
  ADD CONSTRAINT "idempotency_keys_response_status_check"
    CHECK (response_status IS NULL OR response_status BETWEEN 200 AND 599),
  ADD CONSTRAINT "idempotency_keys_expiry_check" CHECK (expires_at > created_at);
