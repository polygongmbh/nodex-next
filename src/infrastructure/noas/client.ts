// Noas sign-in client: username + password_hash → NIP-49 encrypted key,
// decrypted locally with the RAW password. Mirrors nodex use-noas.ts.

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { nip19 } from "nostr-tools";
import { decrypt as nip49Decrypt } from "nostr-tools/nip49";
import { getPublicKey } from "nostr-tools/pure";

export class NoasAuthError extends Error {}

export interface NoasSignInResult {
  pubkeyHex: string;
  privateKeyHex: string;
  relayUrls: string[];
}

export function hashNoasPassword(password: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(password)));
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizePublicKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^[a-f0-9]{64}$/i.test(raw)) return raw.toLowerCase();
  if (raw.startsWith("npub1")) {
    try {
      const decoded = nip19.decode(raw);
      if (decoded.type === "npub") return (decoded.data as string).toLowerCase();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Accept ncryptsec (NIP-49), raw 64-hex, or nsec in the encrypted-key field. */
export function decryptNoasPrivateKey(encryptedKey: string, password: string): string {
  const trimmed = encryptedKey.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (trimmed.startsWith("nsec1")) {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === "nsec") return bytesToHex(decoded.data as Uint8Array);
    throw new NoasAuthError("Received an unreadable private key.");
  }
  try {
    return bytesToHex(nip49Decrypt(trimmed, password));
  } catch {
    throw new NoasAuthError("Could not decrypt your key — check your password.");
  }
}

export async function signInWithNoas(
  apiBaseUrl: string,
  username: string,
  password: string
): Promise<NoasSignInResult> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password_hash: hashNoasPassword(password) }),
      credentials: "include",
    });
  } catch {
    throw new NoasAuthError("Could not reach the sign-in server.");
  }

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || data.success === false) {
    if (response.status === 401) throw new NoasAuthError("Invalid username or password.");
    if (response.status === 403) {
      throw new NoasAuthError(
        typeof data.error === "string" ? data.error : "This account is disabled or unverified."
      );
    }
    throw new NoasAuthError(
      typeof data.error === "string" ? data.error : "Sign-in failed — try again."
    );
  }

  const user = (data.user ?? {}) as Record<string, unknown>;
  const encryptedKey =
    pickString(data, ["encryptedPrivateKey", "encrypted_private_key", "private_key_encrypted"]) ??
    pickString(user, ["encryptedPrivateKey", "encrypted_private_key", "private_key_encrypted"]);
  const responsePubkey = normalizePublicKey(
    pickString(data, ["publicKey", "public_key", "public_npub"]) ??
      pickString(user, ["publicKey", "public_key", "public_npub"])
  );
  if (!encryptedKey) throw new NoasAuthError("The server returned no key for this account.");

  const privateKeyHex = decryptNoasPrivateKey(encryptedKey, password);
  const derivedPubkey = getPublicKey(hexToBytes(privateKeyHex));
  if (responsePubkey && derivedPubkey !== responsePubkey) {
    throw new NoasAuthError("Key mismatch — the decrypted key does not match this account.");
  }

  const relaysRaw = Array.isArray(data.relays) ? data.relays : user.relays;
  const relayUrls = (Array.isArray(relaysRaw) ? relaysRaw : [])
    .filter((relay): relay is string => typeof relay === "string" && relay.trim().length > 0)
    .map((relay) => relay.trim());

  return { pubkeyHex: derivedPubkey, privateKeyHex, relayUrls };
}

export function noasProfilePictureUrl(apiBaseUrl: string, pubkeyHex: string): string {
  return `${apiBaseUrl}/picture/${pubkeyHex}`;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
