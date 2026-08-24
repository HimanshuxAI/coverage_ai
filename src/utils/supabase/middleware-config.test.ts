import { describe, expect, it } from "vitest";
import { readPublicSupabaseConfig } from "./middleware-config";

describe("readPublicSupabaseConfig", () => {
  it("reports missing deployment configuration without inventing credentials", () => {
    expect(
      readPublicSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      })
    ).toEqual({
      configured: false,
      url: "",
      key: "",
    });
  });

  it("accepts the publishable key when deployment configuration is present", () => {
    expect(
      readPublicSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      })
    ).toEqual({
      configured: true,
      url: "https://supabase.example.co",
      key: "publishable-key",
    });
  });
});
