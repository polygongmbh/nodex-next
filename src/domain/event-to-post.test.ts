import { describe, expect, it } from "vitest";
import { classifyEvent, resolveParentId } from "./event-to-post";
import { ALICE, rawEvent } from "@/test/fixtures";

describe("classifyEvent", () => {
  it("converts kind 1 into a post with channels and attribution", () => {
    const classified = classifyEvent(
      rawEvent({ content: "ship it #general", tags: [["t", "launch"]] }),
      ["relay-a"]
    );
    if (classified.type !== "post") throw new Error("expected a post");
    expect(classified.post.channels.sort()).toEqual(["general", "launch"]);
    expect(classified.post.relays).toEqual(["relay-a"]);
    expect(classified.post.parentId).toBeUndefined();
  });

  it("resolves the reply parent by NIP-10 marker precedence", () => {
    const parentTagged = [
      ["e", "1".repeat(64), "", "reply"],
      ["e", "2".repeat(64), "", "parent"],
    ];
    // Legacy parent marker wins over reply (mostr/nodex kind-1621 compat).
    expect(resolveParentId(parentTagged)).toBe("2".repeat(64));
    expect(resolveParentId([["e", "1".repeat(64), "", "reply"]])).toBe("1".repeat(64));
    // A top-level reply carries only a root marker — that root is its parent.
    expect(resolveParentId([["e", "3".repeat(64), "", "root"]])).toBe("3".repeat(64));
    // root + reply: the reply-marked id is the immediate parent.
    expect(
      resolveParentId([
        ["e", "3".repeat(64), "", "root"],
        ["e", "4".repeat(64), "", "reply"],
      ])
    ).toBe("4".repeat(64));
    // Unmarked (deprecated positional) e-tags are citations, not parents.
    expect(resolveParentId([["e", "1".repeat(64)]])).toBeUndefined();
    expect(resolveParentId([["e", "5".repeat(64), "", "mention"]])).toBeUndefined();
  });

  it("classifies state events with their target", () => {
    const classified = classifyEvent(
      rawEvent({ kind: 1631, content: "", tags: [["e", "9".repeat(64)]] }),
      ["relay-a"]
    );
    if (classified.type !== "state") throw new Error("expected a state update");
    expect(classified.targetId).toBe("9".repeat(64));
    expect(classified.update.kind).toBe(1631);
  });

  it("classifies deletions with all referenced ids", () => {
    const classified = classifyEvent(
      rawEvent({ kind: 5, tags: [["e", "1".repeat(64)], ["e", "2".repeat(64)]] }),
      ["relay-a"]
    );
    if (classified.type !== "deletion") throw new Error("expected a deletion");
    expect(classified.targetIds).toHaveLength(2);
    expect(classified.byPubkey).toBe(ALICE);
  });

  it("parses kind 0 metadata and ignores malformed profiles", () => {
    const classified = classifyEvent(
      rawEvent({ kind: 0, content: JSON.stringify({ display_name: "Alice", picture: "https://x/p.png" }) }),
      ["relay-a"]
    );
    if (classified.type !== "person") throw new Error("expected a person");
    expect(classified.person.displayName).toBe("Alice");
    expect(classifyEvent(rawEvent({ kind: 0, content: "not json" }), ["relay-a"]).type).toBe(
      "ignored"
    );
  });
});
