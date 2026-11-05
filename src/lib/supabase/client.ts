import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { databaseConfig, isConfigured } from "@/lib/database";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isConfigured) return null;
  if (!client) client = createClient(databaseConfig.url, databaseConfig.key);
  return client;
}
