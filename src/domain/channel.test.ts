import { describe, expect, it } from "vitest";
import { deriveChannels, postMatchesChannelFilters, spacesForChannels } from "./channel";
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

describe("spacesForChannels", () => {
  const posts = [
    post({ channels: ["dev"], relays: ["one"] }),
    post({ channels: ["design"], relays: ["two"] }),
    post({ channels: ["dev", "ops"], relays: ["two"] }),
  ];
  const scope = ["one", "two", "three"];

  it("returns the scoped spaces carrying any of the channels", () => {
    expect(spacesForChannels(posts, ["dev"], scope).sort()).toEqual(["one", "two"]);
    expect(spacesForChannels(posts, ["design"], scope)).toEqual(["two"]);
  });

  it("unions across multiple channels", () => {
    expect(spacesForChannels(posts, ["design", "ops"], scope)).toEqual(["two"]);
  });

  it("returns empty (no fallback) when no space carries the channels", () => {
    expect(spacesForChannels(posts, ["unknown"], scope)).toEqual([]);
  });
});
