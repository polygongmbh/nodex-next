import { normalizeRelayUrl } from "@/domain/relay-identity";
import { DEFAULT_NOAS_HOST } from "@/infrastructure/noas/config";
import { resolveNoasDiscovery } from "@/infrastructure/noas/discovery";
import { detectSpace } from "@/infrastructure/nostr/space-probe";
import {
  hashNoasPassword,
  NoasAuthError,
  noasProfilePictureUrl,
  registerWithNoas,
  signInWithNoas,
  splitNoasCredentials,
} from "@/infrastructure/noas/client";
import {
  clearSession,
  loadLastHost,
  loadSession,
  saveLastHost,
  saveSession,
  type StoredSession,
} from "@/infrastructure/noas/session";

export type AuthStatus = "restoring" | "signedOut" | "signedIn";

class AuthStore {
  status = $state<AuthStatus>("restoring");
  session = $state<StoredSession | null>(null);
  lastHost = $state("");

  restoreSession(): void {
    this.lastHost = loadLastHost();
    const stored = loadSession();
    if (stored) {
      this.session = stored;
      this.status = "signedIn";
    } else {
      this.status = "signedOut";
    }
  }

  /**
   * The host comes from a user@domain username, else the deployment default —
   * there is no server field. Throws NoasAuthError on failure.
   */
  async signIn(usernameInput: string, password: string): Promise<void> {
    const split = splitNoasCredentials(usernameInput, "");
    const username = split.username;
    const host = split.host || DEFAULT_NOAS_HOST;
    const discovery = await resolveNoasDiscovery(host);
    if (!discovery.apiBaseUrl) throw new NoasAuthError("error.invalidServer");
    const result = await signInWithNoas(discovery.apiBaseUrl, username, password);
    const relayUrls = await this.detectSpaces(host, result.relayUrls, discovery.relays);
    const session: StoredSession = {
      pubkeyHex: result.pubkeyHex,
      privateKeyHex: result.privateKeyHex,
      username,
      apiBaseUrl: discovery.apiBaseUrl,
      relayUrls,
      // Kept for later picture uploads; the private key hex already persists
      // alongside, so this adds no new secret at rest.
      passwordHash: hashNoasPassword(password),
    };
    saveSession(session);
    saveLastHost(host);
    this.lastHost = host;
    this.session = session;
    this.status = "signedIn";
  }

  /**
   * Space auto-detection ladder: the account's own relays, else the tenant
   * defaults noas advertises at discovery, else a reachable relay probed under
   * the noas host's root domain. Empty only when all three come up dry — then
   * onboarding asks for a space.
   */
  private async detectSpaces(
    host: string,
    accountRelays: string[],
    discoveryRelays: string[]
  ): Promise<string[]> {
    if (accountRelays.length > 0) return accountRelays;
    if (discoveryRelays.length > 0) return discoveryRelays;
    const detected = await detectSpace(host);
    return detected ? [detected] : [];
  }

  /**
   * Create an account (optionally with a mined/pasted private key), then try
   * to sign straight in. Returns a server message (e.g. "verify your email")
   * when the account isn't active yet. Throws NoasAuthError on failure.
   */
  async register(
    usernameInput: string,
    password: string,
    options?: { email?: string; privateKeyHex?: string }
  ): Promise<string | null> {
    const split = splitNoasCredentials(usernameInput, "");
    const username = split.username;
    const host = split.host || DEFAULT_NOAS_HOST;
    const { apiBaseUrl } = await resolveNoasDiscovery(host);
    if (!apiBaseUrl) throw new NoasAuthError("error.invalidServer");
    const result = await registerWithNoas(apiBaseUrl, username, password, options);
    try {
      await this.signIn(usernameInput, password);
      return null;
    } catch {
      // Account created but not signed in (e.g. pending email verification).
      return result.message ?? "error.verifyEmail";
    }
  }

  /**
   * Add a space (relay) to the session. Returns the updated session, or null
   * when the input is invalid or already present. The caller restarts the
   * timeline service against the new relay set.
   */
  addRelayUrl(rawUrl: string): StoredSession | null {
    if (!this.session) return null;
    const url = normalizeRelayUrl(rawUrl);
    if (!url) return null;
    const existing = this.session.relayUrls.map(normalizeRelayUrl);
    if (existing.includes(url)) return null;
    const session: StoredSession = {
      ...this.session,
      relayUrls: [...this.session.relayUrls, url],
    };
    saveSession(session);
    this.session = session;
    return session;
  }

  signOut(): void {
    clearSession();
    this.session = null;
    this.status = "signedOut";
  }

  get profilePictureUrl(): string | null {
    if (!this.session) return null;
    return noasProfilePictureUrl(this.session.apiBaseUrl, this.session.pubkeyHex);
  }
}

export const authStore = new AuthStore();
