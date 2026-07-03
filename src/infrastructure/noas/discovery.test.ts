import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveNoasApiBaseUrl } from "./discovery";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveNoasApiBaseUrl", () => {
  it("uses noas.api_base from the well-known document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ noas: { api_base: "/noas/v2" } }), { status: 200 })
      )
    );
    expect(await resolveNoasApiBaseUrl("polygon.example")).toBe("https://polygon.example/noas/v2");
  });

  it("falls back to /api/v1 when discovery fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    expect(await resolveNoasApiBaseUrl("polygon.example")).toBe("https://polygon.example/api/v1");
  });

  it("falls back to /api/v1 when the network errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await resolveNoasApiBaseUrl("polygon.example")).toBe("https://polygon.example/api/v1");
  });

  it("returns empty for invalid input", async () => {
    expect(await resolveNoasApiBaseUrl("   ")).toBe("");
  });
});
