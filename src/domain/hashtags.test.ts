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

  it("does not treat hex colors as hashtags", () => {
    expect(extractHashtagsFromContent("use #fff and #1a2b3c but keep #brand")).toEqual(["brand"]);
  });

  it("dedupes a tag that is also typed in the content", () => {
    expect(deriveChannelTags([["t", "general"]], "hi #general")).toEqual(["general"]);
  });
});
