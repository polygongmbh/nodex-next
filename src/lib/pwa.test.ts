import { describe, expect, it } from "vitest";
import { detectMobileOS } from "./pwa";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  macDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  windowsDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
};

describe("detectMobileOS", () => {
  it("detects iPhone Safari", () => {
    expect(detectMobileOS(UA.iphone)).toBe("ios");
  });

  it("detects iPadOS masquerading as desktop Mac via touch points", () => {
    expect(detectMobileOS(UA.ipadDesktopMode, 5)).toBe("ios");
  });

  it("detects Android Chrome", () => {
    expect(detectMobileOS(UA.androidChrome)).toBe("android");
  });

  it("returns null for a real desktop Mac (no touch points)", () => {
    expect(detectMobileOS(UA.macDesktop, 0)).toBeNull();
  });

  it("returns null for desktop Windows", () => {
    expect(detectMobileOS(UA.windowsDesktop)).toBeNull();
  });
});
