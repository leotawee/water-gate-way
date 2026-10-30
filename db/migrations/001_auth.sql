create extension if not exists citext;
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  password_hash text not null,
  role text not null check (role in ('viewer','operator','admin')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash bytea unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

create table if not exists control_audit (
  id bigserial primary key,
  user_id uuid references users(id),
  command text not null,
  status text not null check (status in ('sent','rejected','failed','rate_limited')),
  ip inet,
  created_at timestamptz not null default now()
);
