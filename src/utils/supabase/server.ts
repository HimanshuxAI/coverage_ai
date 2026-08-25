import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/config/env";

export function resolveServerSupabaseConfig(supabaseEnv: typeof env.supabase): {
  url: string;
  key: string;
} {
  return {
    url: supabaseEnv.url || "https://uzvqxpfdxwckhtvvjkzo.supabase.co",
    key:
      supabaseEnv.serviceRoleKey ||
      supabaseEnv.publishableKey ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key_for_build",
  };
}

export const createClient = async () => {
  const cookieStore = await cookies();
  const { url, key } = resolveServerSupabaseConfig(env.supabase);

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component cookie set ignore
          }
        },
      },
    }
  );
};
