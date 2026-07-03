import { describe, expect, it } from "vitest";
import { mergeProfileContent, personLabel } from "./person";

describe("mergeProfileContent", () => {
  const base = {
    name: "alice",
    display_name: "Old Alice",
    about: "old bio",
    lud16: "alice@wallet.example",
    banner: "https://x/banner.png",
  };

  it("preserves fields this UI does not know about", () => {
    const merged = mergeProfileContent(base, { displayName: "Alice", about: "new bio" });
    expect(merged.lud16).toBe("alice@wallet.example");
    expect(merged.banner).toBe("https://x/banner.png");
    expect(merged.display_name).toBe("Alice");
    expect(merged.about).toBe("new bio");
  });

  it("removes fields the user cleared and skips untouched ones", () => {
    const merged = mergeProfileContent(base, { displayName: "Alice", about: "" });
    expect(merged.about).toBeUndefined();
    expect(merged.name).toBe("alice"); // name not edited → untouched
  });
});

describe("personLabel", () => {
  it("falls back through displayName, name, nip05, pubkey", () => {
    const pubkey = "a".repeat(64);
    expect(personLabel({ pubkey, displayName: "Alice", metadataTimestamp: 0 }, pubkey)).toBe(
      "Alice"
    );
    expect(
      personLabel({ pubkey, nip05: "alice@polygon.example", metadataTimestamp: 0 }, pubkey)
    ).toBe("alice");
    expect(personLabel(undefined, pubkey)).toBe("aaaaaaaa…");
  });
});
