// Dismisses the express splash painted by index.html: the two logo strokes
// slide apart along their diagonal axis while the overlay dissolves and the
// app fades in underneath.

// Minimum time the splash stays up so the glyph is seen rather than flashing.
const MIN_SPLASH_MS = 450;
// Longest dismiss transition in index.html (stroke transform/opacity, 800ms).
const DISMISS_MS = 800;

const splashShownAt = typeof performance !== "undefined" ? performance.now() : 0;

let dismissed = false;

function runDismiss(): void {
  if (dismissed) return;
  dismissed = true;
  document.documentElement.classList.remove("app-loading");
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.add("splash-hide");
  // Fixed timeout, not transitionend: several properties transition and the
  // first transitionend (background, 650ms) would cut the stroke glide.
  window.setTimeout(() => splash.remove(), DISMISS_MS + 150);
}

/** Dismiss after the next paint and the minimum display time, whichever is later. */
export function dismissSplash(): void {
  const elapsed =
    typeof performance !== "undefined" ? performance.now() - splashShownAt : MIN_SPLASH_MS;
  const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(runDismiss, wait);
    });
  });
}
