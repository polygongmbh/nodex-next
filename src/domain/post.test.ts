import { describe, expect, it } from "vitest";
import { foldStateUpdate, postStatus, statusFromKind } from "./post";
import { post } from "@/test/fixtures";

describe("statusFromKind", () => {
  it("maps state kinds to statuses", () => {
    expect(statusFromKind(1631, "")).toBe("done");
    expect(statusFromKind(1632, "")).toBe("closed");
    expect(statusFromKind(1630, "")).toBe("open");
    expect(statusFromKind(1633, "")).toBe("open");
    expect(statusFromKind(1, "")).toBeNull();
  });

  it("treats 1630/1633 with content as active", () => {
    expect(statusFromKind(1630, "working on it")).toBe("active");
    expect(statusFromKind(1633, "picking this back up")).toBe("active");
  });
});

describe("postStatus", () => {
  it("is null for messages and open for fresh tasks", () => {
    expect(postStatus(post({ kind: 1 }))).toBeNull();
    expect(postStatus(post({ kind: 1621 }))).toBe("open");
  });

  it("uses the newest state update regardless of arrival order", () => {
    let task = post({ kind: 1621 });
    task = foldStateUpdate(task, {
      id: "1".repeat(64),
      kind: 1631,
      content: "",
      pubkey: task.pubkey,
      timestamp: 200,
    });
    task = foldStateUpdate(task, {
      id: "2".repeat(64),
      kind: 1630,
      content: "",
      pubkey: task.pubkey,
      timestamp: 100,
    });
    expect(postStatus(task)).toBe("done");
  });

  it("ignores duplicate state updates by id", () => {
    const update = {
      id: "3".repeat(64),
      kind: 1631,
      content: "",
      pubkey: ALICE_LIKE,
      timestamp: 100,
    };
    const once = foldStateUpdate(post({ kind: 1621 }), update);
    expect(foldStateUpdate(once, update)).toBe(once);
  });
});

const ALICE_LIKE = "a".repeat(64);
