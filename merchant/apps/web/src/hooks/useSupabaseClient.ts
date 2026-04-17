"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Returns a Supabase client that passes the Clerk session JWT as the access
 * token. This allows Supabase RLS policies to identify the current user via
 * auth.uid() / auth.jwt() claims.
 *
 * Use this hook in components that need authenticated Supabase queries.
 * For unauthenticated / anon queries keep using getSupabaseBrowserClient().
 */
export function useSupabaseClient() {
  const { session } = useSession();

  return useMemo(() => {
    const url = getSupabaseUrl();
    const key = getSupabasePublishableKey();
    if (!url || !key) return null;

    return createClient(url, key, {
      accessToken: async () => session?.getToken() ?? null,
    });
  }, [session]);
}
