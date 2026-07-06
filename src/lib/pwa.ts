// Pure user-agent classification for the PWA install hint, kept out of the
// component so it is testable without a DOM.
export type MobileOS = "ios" | "android";

export function detectMobileOS(
  userAgent: string,
  maxTouchPoints = 0
): MobileOS | null {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS 13+ reports a desktop-Mac user agent but exposes touch points.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return null;
}
