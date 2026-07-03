import { resolveNoasApiBaseUrl } from "@/infrastructure/noas/discovery";
import {
  NoasAuthError,
  noasProfilePictureUrl,
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

  /** Throws NoasAuthError with a user-readable message on failure. */
  async signIn(hostInput: string, usernameInput: string, password: string): Promise<void> {
    const { username, host } = splitNoasCredentials(usernameInput, hostInput);
    if (!host) {
      throw new NoasAuthError("Add a server, or sign in as user@domain.");
    }
    const apiBaseUrl = await resolveNoasApiBaseUrl(host);
    if (!apiBaseUrl) throw new NoasAuthError("Enter a valid server address.");
    const result = await signInWithNoas(apiBaseUrl, username, password);
    if (result.relayUrls.length === 0) {
      throw new NoasAuthError("This account has no spaces configured.");
    }
    const session: StoredSession = {
      pubkeyHex: result.pubkeyHex,
      privateKeyHex: result.privateKeyHex,
      username,
      apiBaseUrl,
      relayUrls: result.relayUrls,
    };
    saveSession(session);
    saveLastHost(host);
    this.lastHost = host;
    this.session = session;
    this.status = "signedIn";
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
