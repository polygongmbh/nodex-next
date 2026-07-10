import { describe, expect, it } from "vitest";
import {
  hasExistingProfileContent,
  mergeProfileContent,
  parseProfileFields,
  personAbout,
  personLabel,
  personName,
  personPicture,
  personWebsite,
} from "./person";

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

describe("parseProfileFields", () => {
  it("returns trimmed strings and maps display_name", () => {
    const parsed = parseProfileFields({
      name: " alice ",
      display_name: "Alice",
      about: "  hi  ",
      picture: "https://x/p.png",
      website: "https://a.example",
    });
    expect(parsed).toEqual({
      name: "alice",
      displayName: "Alice",
      about: "hi",
      picture: "https://x/p.png",
      website: "https://a.example",
    });
  });

  it("coerces missing and non-string values to empty strings", () => {
    const parsed = parseProfileFields({ name: 42, about: null, lud16: "a@b.c" });
    expect(parsed).toEqual({
      name: "",
      displayName: "",
      about: "",
      picture: "",
      website: "",
    });
  });
});

describe("hasExistingProfileContent", () => {
  it("is false for an empty object (no kind-0 found)", () => {
    expect(hasExistingProfileContent({})).toBe(false);
  });

  it("is true when any field is present", () => {
    expect(hasExistingProfileContent({ name: "alice" })).toBe(true);
    expect(hasExistingProfileContent({ display_name: "Alice", lud16: "a@b.c" })).toBe(true);
  });
});

describe("personLabel", () => {
  it("falls back through display_name, name, nip05, pubkey", () => {
    const pubkey = "a".repeat(64);
    expect(
      personLabel({ pubkey, metadataTimestamp: 0, profile: { display_name: "Alice" } }, pubkey)
    ).toBe("Alice");
    expect(
      personLabel(
        { pubkey, metadataTimestamp: 0, profile: { nip05: "alice@polygon.example" } },
        pubkey
      )
    ).toBe("alice");
    expect(personLabel(undefined, pubkey)).toBe("aaaaaaaa…");
  });

  it("tolerates the camelCase displayName / username wire aliases", () => {
    const pubkey = "b".repeat(64);
    expect(
      personLabel({ pubkey, metadataTimestamp: 0, profile: { displayName: "Bo" } }, pubkey)
    ).toBe("Bo");
    expect(
      personLabel({ pubkey, metadataTimestamp: 0, profile: { username: "bob" } }, pubkey)
    ).toBe("bob");
  });
});

describe("person accessors preserve the full profile", () => {
  const pubkey = "c".repeat(64);
  const person = {
    pubkey,
    metadataTimestamp: 0,
    profile: {
      name: " carol ",
      picture: "https://x/c.png",
      about: "  hi  ",
      website: "https://c.example",
      lud16: "carol@wallet.example",
      banner: "https://x/banner.png",
      customKey: { nested: true },
    },
  };

  it("reads and trims known fields", () => {
    expect(personName(person)).toBe("carol");
    expect(personPicture(person)).toBe("https://x/c.png");
    expect(personAbout(person)).toBe("hi");
    expect(personWebsite(person)).toBe("https://c.example");
  });

  it("keeps unknown/extra fields verbatim on person.profile", () => {
    expect(person.profile.lud16).toBe("carol@wallet.example");
    expect(person.profile.banner).toBe("https://x/banner.png");
    expect(person.profile.customKey).toEqual({ nested: true });
  });

  it("returns empty strings for a missing person", () => {
    expect(personName(undefined)).toBe("");
    expect(personPicture(undefined)).toBe("");
  });
});
