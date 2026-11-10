-- 004_profile.sql — profile fields (contact details + avatar) and the account action log.
-- Apply by hand on the droplet BEFORE deploying the code that reads these columns:
--   sudo docker exec -i watergate-postgres psql -U postgres -d <DBNAME> < db/migrations/004_profile.sql

alter table users
  add column if not exists display_name text check (char_length(display_name) between 1 and 60),
  add column if not exists phone text check (char_length(phone) between 0 and 20),
  add column if not exists line_id text check (char_length(line_id) between 0 and 60),
  add column if not exists avatar_webp bytea,
  add column if not exists avatar_updated_at timestamptz;

-- Account-level action log (profile/avatar edits, sign-in, sign-out) — same shape as admin_audit.
create table if not exists action_audit (
  id         bigserial primary key,
  user_id    uuid references users(id),
  action     text not null,
  detail     text not null default '',
  ip         inet,
  created_at timestamptz not null default now()
);
create index if not exists action_audit_created_idx on action_audit (created_at desc);
create index if not exists action_audit_user_idx on action_audit (user_id, created_at desc);

-- Grants for the app DB role (same DML set as users/audits). Tolerates DBs without the role.
do $$ begin
  execute 'grant select, insert, update, delete on action_audit to water_admin';
  execute 'grant usage, select on sequence action_audit_id_seq to water_admin';
exception when undefined_object then null; -- local/dev databases without the app role
end $$;
