-- Shared menu, prices, wheel offers, UPI details and admin PIN.
-- Run after the base orders schema.

create table if not exists app_settings (
  id smallint primary key check (id = 1),
  data jsonb not null default '{}'::jsonb,
  pin_hash text,
  pin_salt text,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
