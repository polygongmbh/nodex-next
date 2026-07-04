// Reference adapter for the cross-client spec vectors — noas auth contracts.
// Symbolic key references ("secretHex", "npub", …) resolve via vectors.keys.

import { afterEach, describe, expect, it, vi } from "vitest";
import vectors from "../../spec/vectors/noas.json";
import {
  decryptNoasPrivateKey,
  hashNoasPassword,
  NoasAuthError,
  signInWithNoas,
  splitNoasCredentials,
} from "@/infrastructure/noas/client";

const keys = vectors.keys as Record<string, string>;

function resolveKeyRefs(value: unknown): unknown {
  if (typeof value === "string") return keys[value] ?? value;
  if (Array.isArray(value)) return value.map(resolveKeyRefs);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveKeyRefs(entry)])
    );
  }
  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("vectors: noas password hash", () => {
  it.each(vectors.passwordHash)("$name", ({ password, expected }) => {
    expect(hashNoasPassword(password)).toBe(expected);
  });
});

describe("vectors: noas credentials", () => {
  it.each(vectors.splitCredentials)("$name", ({ username, host, expected }) => {
    expect(splitNoasCredentials(username, host)).toEqual(expected);
  });
});

describe("vectors: noas key decryption", () => {
  it.each(vectors.decryptPrivateKey)("$name", (vector) => {
    const input = keys[vector.input] ?? vector.input;
    if (vector.expectedError) {
      expect(() => decryptNoasPrivateKey(input, vector.password)).toThrowError(
        new NoasAuthError(vector.expectedError)
      );
    } else {
      expect(decryptNoasPrivateKey(input, vector.password)).toBe(keys[vector.expected!]);
    }
  });
});

describe("vectors: noas sign-in responses", () => {
  it.each(vectors.signInResponses)("$name", async (vector) => {
    const body = resolveKeyRefs(vector.body);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status: vector.status }))
    );
    const attempt = signInWithNoas("https://api.example/api/v1", "alice", vector.password);
    if (vector.expectedError) {
      await expect(attempt).rejects.toThrowError(new NoasAuthError(vector.expectedError));
    } else {
      const result = await attempt;
      const expected = resolveKeyRefs(vector.expected) as Record<string, unknown>;
      if (expected.pubkeyHex) expect(result.pubkeyHex).toBe(expected.pubkeyHex);
      if (expected.privateKeyHex) expect(result.privateKeyHex).toBe(expected.privateKeyHex);
      if (expected.relayUrls) expect(result.relayUrls).toEqual(expected.relayUrls);
    }
  });
});

describe("vectors: profile merge", () => {
  it.each(vectors.profileMerge)("$name", async ({ base, edits, expected }) => {
    const { mergeProfileContent } = await import("@/domain/person");
    expect(mergeProfileContent(base, edits)).toEqual(expected);
  });
});
