import { createClient } from "@supabase/supabase-js";

// Ensure these environment variables are available
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase environment variables are missing. Database functionality will not work.");
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseServerClient() {
  // In a real implementation with SSR, you'd use @supabase/ssr here
  // For the initial architecture, we are providing a simple client.
  // We will enhance this when we reach Phase 3 (Authentication).
  return createClient(supabaseUrl, supabaseAnonKey);
}
