// Session persistence. Storing the decrypted key is the web equivalent of
// nodex's "trust this browser" — noas sign-in is the only auth path here, so
// the session always persists; sign-out clears it. Malformed entries are
// rejected, never migrated (the next sign-in rebuilds them).

const SESSION_KEY = "nodex-next.session.v1";
const LAST_HOST_KEY = "nodex-next.last-host.v1";

export interface StoredSession {
  pubkeyHex: string;
  privateKeyHex: string;
  username: string;
  apiBaseUrl: string;
  relayUrls: string[];
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.pubkeyHex === "string" &&
    /^[a-f0-9]{64}$/.test(session.pubkeyHex) &&
    typeof session.privateKeyHex === "string" &&
    /^[a-f0-9]{64}$/.test(session.privateKeyHex) &&
    typeof session.username === "string" &&
    typeof session.apiBaseUrl === "string" &&
    Array.isArray(session.relayUrls) &&
    session.relayUrls.every((url) => typeof url === "string")
  );
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredSession(parsed)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function loadLastHost(): string {
  try {
    return localStorage.getItem(LAST_HOST_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveLastHost(host: string): void {
  localStorage.setItem(LAST_HOST_KEY, host);
}
