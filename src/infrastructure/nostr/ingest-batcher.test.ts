import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIngestBatcher } from "./ingest-batcher";
import { rawEvent } from "@/test/fixtures";

const RELAY = "wss://one.example/";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createIngestBatcher", () => {
  it("holds events until the fast first flush, preserving order", () => {
    const applied: string[] = [];
    const batcher = createIngestBatcher((raw) => applied.push(raw.id));
    const first = rawEvent();
    const second = rawEvent();
    batcher.push(first, RELAY);
    batcher.push(second, RELAY);
    expect(applied).toEqual([]);
    vi.advanceTimersByTime(50);
    expect(applied).toEqual([first.id, second.id]);
  });

  it("flushes later arrivals on the coarse interval, not per event", () => {
    const applied: string[] = [];
    const batcher = createIngestBatcher((raw) => applied.push(raw.id));
    batcher.push(rawEvent(), RELAY);
    vi.advanceTimersByTime(50);
    expect(applied).toHaveLength(1);

    const late = rawEvent();
    batcher.push(late, RELAY);
    vi.advanceTimersByTime(400);
    expect(applied).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(applied).toEqual([applied[0], late.id]);
  });

  it("settle flushes the buffer and switches to immediate pass-through", () => {
    const applied: string[] = [];
    const batcher = createIngestBatcher((raw) => applied.push(raw.id));
    const buffered = rawEvent();
    batcher.push(buffered, RELAY);
    batcher.settle();
    expect(applied).toEqual([buffered.id]);

    const live = rawEvent();
    batcher.push(live, RELAY);
    expect(applied).toEqual([buffered.id, live.id]);
  });

  it("dispose drops buffered events and never applies them", () => {
    const applied: string[] = [];
    const batcher = createIngestBatcher((raw) => applied.push(raw.id));
    batcher.push(rawEvent(), RELAY);
    batcher.dispose();
    vi.runAllTimers();
    expect(applied).toEqual([]);
  });
});
