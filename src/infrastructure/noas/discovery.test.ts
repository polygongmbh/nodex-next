import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveNoasDiscovery } from "./discovery";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveNoasDiscovery relays", () => {
  it("parses the tenant default spaces from noas.relays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ noas: { api_base: "/api/v1", relays: ["wss://tasks.acme.com", " ", 3] } }),
          { status: 200 }
        )
      )
    );
    const discovery = await resolveNoasDiscovery("acme.com");
    expect(discovery.relays).toEqual(["wss://tasks.acme.com"]);
  });

  it("is empty when noas.relays is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ noas: { api_base: "/api/v1" } }), { status: 200 }))
    );
    expect((await resolveNoasDiscovery("acme.com")).relays).toEqual([]);
  });

  it("is empty when discovery fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    expect((await resolveNoasDiscovery("acme.com")).relays).toEqual([]);
  });
});
