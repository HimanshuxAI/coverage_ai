import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/config/env";

export const createClient = async () => {
  const cookieStore = await cookies();
  const url = env.supabase.url || "https://uzvqxpfdxwckhtvvjkzo.supabase.co";
  const key = env.supabase.publishableKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key_for_build";

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
