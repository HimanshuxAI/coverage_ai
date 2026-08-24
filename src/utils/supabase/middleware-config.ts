export interface PublicSupabaseConfig {
  configured: boolean;
  url: string;
  key: string;
}

export function readPublicSupabaseConfig(
  runtimeEnv: Record<string, string | undefined> = process.env
): PublicSupabaseConfig {
  const url = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = runtimeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return {
    configured: Boolean(url && key),
    url,
    key,
  };
}
