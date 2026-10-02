import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "mentira-profissional:supabase-config";

export type SupabaseConfig = {
  url: string;
  key: string;
};

export function readSupabaseConfig(): SupabaseConfig | null {
  if (typeof window === "undefined") return null;

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (envUrl && envKey) return { url: envUrl, key: envKey };

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<SupabaseConfig>;
    if (parsed.url && parsed.key) return { url: parsed.url, key: parsed.key };
  } catch {
    // Ignore malformed local config.
  }

  return null;
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearSupabaseConfig() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function createBrowserSupabase(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.key, {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
