import { afterEach, describe, expect, it, vi } from "vitest";

describe("process-request client boundary", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("./registry");
    vi.doUnmock("@/config/env");
  });

  it("loads and parses workflow keys without importing registry or env", async () => {
    vi.resetModules();
    vi.doMock("./registry", () => {
      throw new Error("process-request must not import registry");
    });
    vi.doMock("@/config/env", () => {
      throw new Error("process-request must not import env");
    });

    const processRequestModule = await import("./process-request");

    expect(processRequestModule.parseProcessRequest({ workflowKey: "preauth" })).toEqual({
      ok: true,
      workflowKey: "preauth",
    });
  });
});
