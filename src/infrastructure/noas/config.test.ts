import { describe, expect, it } from "vitest";

import { FLAGSHIP_NOAS_HOST, resolveDefaultNoasHost } from "./config";

describe("resolveDefaultNoasHost", () => {
  it("falls back to the flagship host when the flag is unset", () => {
    expect(resolveDefaultNoasHost(undefined, "tasks.acme.com")).toBe(FLAGSHIP_NOAS_HOST);
  });

  it("uses a configured host verbatim, trimmed", () => {
    expect(resolveDefaultNoasHost("noas.example.org", "tasks.acme.com")).toBe("noas.example.org");
    expect(resolveDefaultNoasHost("  noas.example.org  ", "tasks.acme.com")).toBe(
      "noas.example.org"
    );
  });

  it("adopts the deployment's root domain when the flag is explicitly empty", () => {
    expect(resolveDefaultNoasHost("", "tasks.acme.com")).toBe("acme.com");
    expect(resolveDefaultNoasHost("", "acme.com")).toBe("acme.com");
    // Whitespace-only counts as empty and still derives from the deployment.
    expect(resolveDefaultNoasHost("   ", "app.polygon.gmbh")).toBe("polygon.gmbh");
  });

  it("falls back to the flagship when an empty flag has no usable deployment root", () => {
    expect(resolveDefaultNoasHost("", "localhost")).toBe(FLAGSHIP_NOAS_HOST);
    expect(resolveDefaultNoasHost("", "192.168.1.10")).toBe(FLAGSHIP_NOAS_HOST);
    expect(resolveDefaultNoasHost("", "intranet")).toBe(FLAGSHIP_NOAS_HOST);
    expect(resolveDefaultNoasHost("", undefined)).toBe(FLAGSHIP_NOAS_HOST);
  });
});
