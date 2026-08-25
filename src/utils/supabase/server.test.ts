import { describe, expect, it } from "vitest";

import { resolveServerSupabaseConfig } from "./server";

describe("resolveServerSupabaseConfig", () => {
  it("prefers the service-role key for server-side Supabase reads", () => {
    expect(
      resolveServerSupabaseConfig({
        url: "https://supabase.example.co",
        publishableKey: "publishable-key",
        serviceRoleKey: "service-role-key",
      })
    ).toEqual({
      url: "https://supabase.example.co",
      key: "service-role-key",
    });
  });

  it("falls back to the publishable key when service-role credentials are not configured", () => {
    expect(
      resolveServerSupabaseConfig({
        url: "https://supabase.example.co",
        publishableKey: "publishable-key",
        serviceRoleKey: "",
      })
    ).toEqual({
      url: "https://supabase.example.co",
      key: "publishable-key",
    });
  });
});
