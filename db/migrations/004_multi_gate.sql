-- 004: multi-gate support. Additive and idempotent: only adds columns and an index.
--
-- Apply with: PGOPTIONS='-c search_path=wgw,public' psql -1 -v ON_ERROR_STOP=1 -f db/migrations/004_multi_gate.sql
--
-- Deploy order (the owner applies this; it is not applied by any script):
--   1. Apply this migration.
--   2. Deploy the new code (it reads control_audit.gate_id and the new gates columns).
--   3. Run the backfill below once, then run it again after the old image has
--      stopped writing 'stm32-radar'.
--
-- Backfill (run deliberately by hand, not part of this file's executable body):
-- update water_levels set device_id = 'gate-1' where device_id = 'stm32-radar';

alter table gates add column if not exists media_base_url text;
alter table gates add column if not exists cameras text[] not null default '{}';
alter table gates add column if not exists enrolled_at timestamptz;
alter table gates add column if not exists last_seen_at timestamptz;

alter table control_audit add column if not exists gate_id text;

-- WHY: water_levels predates the migrations in this repo (old public schema); guard so a database
-- bootstrapped from 001-004 alone does not fail here.
do $$ begin
  if to_regclass('public.water_levels') is not null then
    create index if not exists water_levels_device_time_idx on water_levels (device_id, measured_at);
  end if;
end $$;
