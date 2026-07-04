import { describe, expect, it } from "vitest";
import { deriveChannelTags, extractHashtagsFromContent } from "./hashtags";

describe("deriveChannelTags", () => {
  it("unions t-tags and content hashtags, lowercased", () => {
    const channels = deriveChannelTags(
      [["t", "Design"], ["p", "f".repeat(64)]],
      "kickoff for #General tomorrow"
    );
    expect(channels.sort()).toEqual(["design", "general"]);
  });

  it("excludes uppercase hex and digit-only colors, keeps lowercase tags", () => {
    expect(
      extractHashtagsFromContent("bg #FEE fg #FE0F accent #123FEF alpha #A1B2C3D4 keep #fee #abc123")
    ).toEqual(["fee", "abc123"]);
    expect(extractHashtagsFromContent("mix #Fee odd #GHI len5 #ABCDE pure #123")).toEqual([
      "fee",
      "ghi",
      "abcde",
    ]);
  });

  it("dedupes a tag that is also typed in the content", () => {
    expect(deriveChannelTags([["t", "general"]], "hi #general")).toEqual(["general"]);
  });
});
