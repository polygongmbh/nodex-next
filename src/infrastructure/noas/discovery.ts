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

export async function resolveNoasApiBaseUrl(host: string): Promise<string> {
  const normalized = normalizeNoasBaseUrl(host);
  if (!isValidNoasBaseUrl(normalized)) return "";
  let origin: string;
  try {
    origin = new URL(normalized).origin;
  } catch {
    return "";
  }

  try {
    const response = await fetch(`${origin}/.well-known/nostr.json`, {
      headers: { Accept: "application/nostr+json, application/json" },
    });
    if (response.ok) {
      const document = (await response.json()) as { noas?: { api_base?: unknown } };
      const rawApiBase = document.noas?.api_base;
      if (typeof rawApiBase === "string" && rawApiBase.trim()) {
        const apiBase = rawApiBase.trim().startsWith("/")
          ? `${origin}${rawApiBase.trim()}`
          : rawApiBase.trim();
        const normalizedApiBase = normalizeNoasBaseUrl(apiBase);
        if (isValidNoasBaseUrl(normalizedApiBase)) return normalizedApiBase;
      }
    }
  } catch {
    // Discovery is best-effort; fall through to the conventional path.
  }
  return fallbackApiBaseUrl(normalized);
}
