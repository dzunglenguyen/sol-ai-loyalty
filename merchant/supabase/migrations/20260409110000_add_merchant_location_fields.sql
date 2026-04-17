alter table public.merchant_profiles
  add column if not exists address_text text,
  add column if not exists maps_url text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
