// Noas host discovery: GET https://<host>/.well-known/nostr.json → noas.api_base,
// falling back to https://<host>/api/v1 when the document is missing or invalid.

export function normalizeNoasBaseUrl(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export function isValidNoasBaseUrl(rawValue: string): boolean {
  const normalized = normalizeNoasBaseUrl(rawValue);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function fallbackApiBaseUrl(host: string): string {
  const normalized = normalizeNoasBaseUrl(host);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const path = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = path && path !== "/" ? path : "/api/v1";
    parsed.search = "";
    parsed.hash = "";
    return normalizeNoasBaseUrl(parsed.toString());
  } catch {
    return normalized;
  }
}

export type NoasEmailVerificationMode = "required" | "optional" | "none";

export interface NoasDiscovery {
  apiBaseUrl: string;
  emailVerificationMode: NoasEmailVerificationMode;
  /** Tenant default spaces advertised by noas; empty when none / unavailable. */
  relays: string[];
}

function resolveEmailMode(raw: unknown): NoasEmailVerificationMode {
  if (raw === "required" || raw === "optional") return raw;
  return "none";
}

function resolveRelays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((relay): relay is string => typeof relay === "string" && relay.trim().length > 0)
    .map((relay) => relay.trim());
}

/**
 * Full discovery: api_base plus the host's email_verification_mode from the
 * `noas` extension of `.well-known/nostr.json` (fallback: conventional
 * /api/v1 path, mode "none").
 */
export async function resolveNoasDiscovery(host: string): Promise<NoasDiscovery> {
  const normalized = normalizeNoasBaseUrl(host);
  if (!isValidNoasBaseUrl(normalized)) {
    return { apiBaseUrl: "", emailVerificationMode: "none", relays: [] };
  }
  let origin: string;
  try {
    origin = new URL(normalized).origin;
  } catch {
    return { apiBaseUrl: "", emailVerificationMode: "none", relays: [] };
  }

  try {
    const response = await fetch(`${origin}/.well-known/nostr.json`, {
      headers: { Accept: "application/nostr+json, application/json" },
    });
    if (response.ok) {
      const document = (await response.json()) as {
        noas?: { api_base?: unknown; email_verification_mode?: unknown; relays?: unknown };
      };
      const emailVerificationMode = resolveEmailMode(document.noas?.email_verification_mode);
      const relays = resolveRelays(document.noas?.relays);
      const rawApiBase = document.noas?.api_base;
      if (typeof rawApiBase === "string" && rawApiBase.trim()) {
        const apiBase = rawApiBase.trim().startsWith("/")
          ? `${origin}${rawApiBase.trim()}`
          : rawApiBase.trim();
        const normalizedApiBase = normalizeNoasBaseUrl(apiBase);
        if (isValidNoasBaseUrl(normalizedApiBase)) {
          return { apiBaseUrl: normalizedApiBase, emailVerificationMode, relays };
        }
      }
      return { apiBaseUrl: fallbackApiBaseUrl(normalized), emailVerificationMode, relays };
    }
  } catch {
    // Discovery is best-effort; fall through to the conventional path.
  }
  return { apiBaseUrl: fallbackApiBaseUrl(normalized), emailVerificationMode: "none", relays: [] };
}
