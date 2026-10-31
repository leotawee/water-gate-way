create table if not exists gates (
  id          text primary key check (id ~ '^gate-[0-9]{1,4}$'),
  name        text not null check (length(name) between 1 and 100),
  location    text not null default '' check (length(location) <= 200),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  has_device  boolean not null default false,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists admin_audit (
  id          bigserial primary key,
  actor_id    uuid references users(id),
  action      text not null,
  target      text not null,
  ip          inet,
  created_at  timestamptz not null default now()
);

-- Old gates: public.devices.device_id 'GATE-001' becomes 'gate-1' (the id the URLs already use).
insert into gates (id, name, location, lat, lng, has_device, active)
select 'gate-' || ltrim(substring(d.device_id from '[0-9]+$'), '0'),
       d.name, coalesce(d.location_name, ''),
       -- WHY: old columns are real; rounding stops 18.795 turning into 18.7950000762939.
       round(d.lat::numeric, 6)::float8, round(d.lng::numeric, 6)::float8,
       d.device_id = 'GATE-001',   -- only gate 1 has an STM32 and cameras today
       coalesce(d.is_active, true)
from public.devices d
where d.device_id ~ '^GATE-[0-9]+$'
on conflict (id) do nothing;

-- Old accounts keep their bcrypt hash; it is replaced by scrypt on first login.
-- Old role 'admin' stays admin; anything else becomes 'viewer' (least privilege; an admin can promote).
insert into users (email, password_hash, role, created_at)
select lower(trim(u.email)), u.password_hash,
       case when u.role = 'admin' then 'admin' else 'viewer' end,
       coalesce(u.created_at, now())
from public.users u
where u.email is not null and u.password_hash like '$2%'
on conflict (email) do nothing;
