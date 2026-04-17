-- Do not block auth.users insert if merchant_profiles row fails (RLS, duplicate, etc.).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  begin
    insert into public.merchant_profiles (user_id, external_key, business_name)
    values (
      new.id,
      new.id::text,
      nullif(trim(coalesce(new.raw_user_meta_data->>'business_name', '')), '')
    );
  exception
    when unique_violation then
      null;
    when foreign_key_violation then
      null;
    when others then
      raise warning 'handle_new_user skipped for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
