import { afterEach, describe, expect, it, vi } from "vitest";
import { bytesToHex } from "@noble/hashes/utils.js";
import { encrypt as nip49Encrypt } from "nostr-tools/nip49";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";
import {
  decryptNoasPrivateKey,
  hashNoasPassword,
  NoasAuthError,
  signInWithNoas,
  splitNoasCredentials,
} from "./client";

const PASSWORD = "correct horse";
const secretKey = generateSecretKey();
const secretHex = bytesToHex(secretKey);
const pubkeyHex = getPublicKey(secretKey);

function mockSignInResponse(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decryptNoasPrivateKey", () => {
  it("round-trips a NIP-49 encrypted key", () => {
    const ncryptsec = nip49Encrypt(secretKey, PASSWORD);
    expect(decryptNoasPrivateKey(ncryptsec, PASSWORD)).toBe(secretHex);
  });

  it("rejects a wrong password with a readable error", () => {
    const ncryptsec = nip49Encrypt(secretKey, PASSWORD);
    expect(() => decryptNoasPrivateKey(ncryptsec, "wrong")).toThrow(NoasAuthError);
  });

  it("accepts raw hex and nsec values", () => {
    expect(decryptNoasPrivateKey(secretHex, PASSWORD)).toBe(secretHex);
    expect(decryptNoasPrivateKey(nip19.nsecEncode(secretKey), PASSWORD)).toBe(secretHex);
  });
});

describe("splitNoasCredentials", () => {
  it("derives the host from a user@domain username", () => {
    expect(splitNoasCredentials("alice@polygon.example", "")).toEqual({
      username: "alice",
      host: "polygon.example",
    });
  });

  it("lets an explicit host win over the username domain", () => {
    expect(splitNoasCredentials("alice@polygon.example", "other.example").host).toBe(
      "other.example"
    );
  });

  it("passes plain usernames through untouched", () => {
    expect(splitNoasCredentials("alice", "polygon.example")).toEqual({
      username: "alice",
      host: "polygon.example",
    });
  });
});

describe("signInWithNoas", () => {
  it("sends the sha256 password hash, never the raw password", async () => {
    mockSignInResponse({
      success: true,
      private_key_encrypted: secretHex,
      public_key: pubkeyHex,
      relays: ["wss://one.example"],
    });
    await signInWithNoas("https://api.example/api/v1", "alice", PASSWORD);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.password_hash).toBe(hashNoasPassword(PASSWORD));
    expect(JSON.stringify(body)).not.toContain(PASSWORD);
  });

  it("accepts field aliases and npub public keys", async () => {
    mockSignInResponse({
      success: true,
      encryptedPrivateKey: nip49Encrypt(secretKey, PASSWORD),
      public_npub: nip19.npubEncode(pubkeyHex),
      relays: ["wss://one.example", "wss://two.example"],
    });
    const result = await signInWithNoas("https://api.example/api/v1", "alice", PASSWORD);
    expect(result.pubkeyHex).toBe(pubkeyHex);
    expect(result.privateKeyHex).toBe(secretHex);
    expect(result.relayUrls).toHaveLength(2);
  });

  it("rejects a key that does not match the returned public key", async () => {
    mockSignInResponse({
      success: true,
      private_key_encrypted: secretHex,
      public_key: "f".repeat(64),
      relays: ["wss://one.example"],
    });
    await expect(signInWithNoas("https://api.example/api/v1", "alice", PASSWORD)).rejects.toThrow(
      /mismatch/i
    );
  });

  it("maps 401 to an invalid-credentials message", async () => {
    mockSignInResponse({ success: false }, 401);
    await expect(signInWithNoas("https://api.example/api/v1", "alice", PASSWORD)).rejects.toThrow(
      /invalid username or password/i
    );
  });
});
