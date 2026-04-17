create table if not exists public.store_documents (
  id uuid primary key default gen_random_uuid(),
  merchant_key text not null,
  doc_type text not null check (doc_type in ('menu', 'space_image', 'brand_voice')),
  title text not null,
  file_name text,
  extracted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_documents_merchant_key_idx
  on public.store_documents (merchant_key);

create index if not exists store_documents_doc_type_idx
  on public.store_documents (doc_type);

alter table public.store_documents enable row level security;

drop policy if exists "store_documents_select_open" on public.store_documents;
create policy "store_documents_select_open"
  on public.store_documents
  for select
  to anon, authenticated
  using (true);

drop policy if exists "store_documents_insert_open" on public.store_documents;
create policy "store_documents_insert_open"
  on public.store_documents
  for insert
  to anon, authenticated
  with check (merchant_key is not null and merchant_key <> '');

drop policy if exists "store_documents_update_open" on public.store_documents;
create policy "store_documents_update_open"
  on public.store_documents
  for update
  to anon, authenticated
  using (true)
  with check (merchant_key is not null and merchant_key <> '');

drop policy if exists "store_documents_delete_open" on public.store_documents;
create policy "store_documents_delete_open"
  on public.store_documents
  for delete
  to anon, authenticated
  using (true);
