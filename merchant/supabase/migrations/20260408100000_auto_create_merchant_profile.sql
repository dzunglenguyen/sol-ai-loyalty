-- Auto-create merchant_profiles row when a new user signs up.
-- Uses auth.users.id as external_key so each user owns their own data.

-- 1. Add user_id FK to merchant_profiles
alter table public.merchant_profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists merchant_profiles_user_id_idx
  on public.merchant_profiles (user_id);

-- 2. Trigger function (private schema so it's not exposed via Data API)
create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.merchant_profiles (user_id, external_key, business_name)
  values (
    new.id,
    new.id::text,
    coalesce(new.raw_user_meta_data->>'business_name', '')
  );
  return new;
end;
$$;

-- 3. Wire up to auth.users inserts
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
