import { describe, expect, it } from "vitest";
import { deriveChannels, postMatchesChannelFilters } from "./channel";
import { post } from "@/test/fixtures";

describe("postMatchesChannelFilters", () => {
  const multi = post({ channels: ["general", "design"] });

  it("requires ALL included channels (AND semantics)", () => {
    expect(postMatchesChannelFilters(multi, { general: "included" })).toBe(true);
    expect(
      postMatchesChannelFilters(multi, { general: "included", design: "included" })
    ).toBe(true);
    expect(
      postMatchesChannelFilters(multi, { general: "included", random: "included" })
    ).toBe(false);
  });

  it("rejects posts carrying an excluded channel", () => {
    expect(postMatchesChannelFilters(multi, { design: "excluded" })).toBe(false);
    expect(postMatchesChannelFilters(post({ channels: ["general"] }), { design: "excluded" })).toBe(
      true
    );
  });

  it("matches everything when no filters are set", () => {
    expect(postMatchesChannelFilters(multi, {})).toBe(true);
  });
});

describe("deriveChannels", () => {
  it("counts posts per channel, most-used first", () => {
    const channels = deriveChannels([
      post({ channels: ["general"] }),
      post({ channels: ["general", "design"] }),
    ]);
    expect(channels).toEqual([
      { name: "general", postCount: 2 },
      { name: "design", postCount: 1 },
    ]);
  });
});
