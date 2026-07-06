// Vanity key mining, ported from nodex: loop fresh keypairs until the npub's
// bech32 prefix matches the target (usually the username's first letters).
// The prefix is computed from the first pubkey bytes directly — no full
// bech32 encode per attempt.

import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { bytesToHex } from "@noble/hashes/utils.js";

export const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
export const MAX_VANITY_PREFIX = 3;
export const DEFAULT_MAX_ATTEMPTS = 2_000_000;

/** First `length` npub data chars (after "npub1") for a hex pubkey. */
export function npubPrefixFromPubkey(pubkeyHex: string, length: number): string {
  const b0 = parseInt(pubkeyHex.slice(0, 2), 16);
  const b1 = parseInt(pubkeyHex.slice(2, 4), 16);
  const words = [b0 >> 3, ((b0 & 0x07) << 2) | (b1 >> 6), (b1 >> 1) & 0x1f];
  return words
    .slice(0, Math.min(length, MAX_VANITY_PREFIX))
    .map((word) => BECH32_CHARSET[word])
    .join("");
}

/** Bech32-safe mining target from a username's local part (≤3 chars). */
export function vanityTargetFromUsername(username: string, length = MAX_VANITY_PREFIX): string {
  const local = username.split("@")[0].toLowerCase();
  const safe = Array.from(local)
    .filter((char) => BECH32_CHARSET.includes(char))
    .join("");
  return safe.slice(0, Math.min(length, MAX_VANITY_PREFIX));
}

export interface MinedKey {
  secretHex: string;
  pubkeyHex: string;
  attempts: number;
}

export function mineVanityKey(
  target: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): MinedKey | null {
  const prefix = target.slice(0, MAX_VANITY_PREFIX);
  for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
    const secret = generateSecretKey();
    const pubkeyHex = getPublicKey(secret);
    if (!prefix || npubPrefixFromPubkey(pubkeyHex, prefix.length) === prefix) {
      return { secretHex: bytesToHex(secret), pubkeyHex, attempts };
    }
  }
  return null;
}
