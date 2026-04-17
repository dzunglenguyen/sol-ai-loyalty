/** Resolve Supabase URL / key from env (names differ across dashboards and templates). */

export function getSupabaseUrl(): string | undefined {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return v || undefined;
}

export function getSupabasePublishableKey(): string | undefined {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return v || undefined;
}
