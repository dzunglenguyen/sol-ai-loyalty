import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

let browserClient: SupabaseClient | null = null;
const MERCHANT_KEY_STORAGE = "shinhan.merchantKey";

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}

// Clerk user ID — set from (app)/layout.tsx after Clerk loads
let _currentUserId: string | null = null;

export function setCurrentUserId(id: string | null) {
  const normalized = id?.trim() || null;
  _currentUserId = normalized;
  if (typeof window === "undefined") return;
  try {
    if (normalized) {
      window.localStorage.setItem(MERCHANT_KEY_STORAGE, normalized);
    } else {
      window.localStorage.removeItem(MERCHANT_KEY_STORAGE);
    }
  } catch {
    // Ignore storage errors in restricted browser modes.
  }
}

export async function getCurrentMerchantKey(): Promise<string> {
  if (_currentUserId) return _currentUserId;

  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(MERCHANT_KEY_STORAGE)?.trim() || "";
      if (cached) {
        _currentUserId = cached;
        return cached;
      }
    } catch {
      // Ignore storage errors in restricted browser modes.
    }
  }

  // Clerk user id is synced via React effect in layout; wait briefly
  // to avoid first-render race that makes Knowledge Base look empty.
  const startedAt = Date.now();
  const timeoutMs = 5000;
  while (!_currentUserId && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return _currentUserId ?? "";
}
