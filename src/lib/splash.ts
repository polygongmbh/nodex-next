// Dismisses the express splash painted by index.html. The strokes CONVERGE
// on startup (CSS animation in index.html); dismissal either fades the
// assembled glyph out (signed in) or glides it into the sign-in card's logo
// position (signed out), where the identical inline glyph takes over.

// Minimum time the splash stays up so the converge animation is seen.
const MIN_SPLASH_MS = 750;
// Longest dismiss transition (svg transform glide in index.html).
const DISMISS_MS = 650;

const splashShownAt = typeof performance !== "undefined" ? performance.now() : 0;

let dismissed = false;

export interface SplashDismissal {
  /** Bounding box of the sign-in glyph the splash logo should glide into. */
  target?: DOMRect;
}

function runDismiss(target?: DOMRect): void {
  if (dismissed) return;
  dismissed = true;

  document.documentElement.classList.remove("app-loading");
  const splash = document.getElementById("splash");
  if (!splash) return;
  const svg = splash.querySelector("svg");

  splash.classList.add("splash-hide");
  if (target && svg) {
    // Glide + zoom the centered glyph into the target rect (transform-origin
    // is the svg center, so translate between centers and scale to fit).
    const current = svg.getBoundingClientRect();
    const dx = target.left + target.width / 2 - (current.left + current.width / 2);
    const dy = target.top + target.height / 2 - (current.top + current.height / 2);
    const scale = target.width / current.width;
    svg.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  } else {
    splash.classList.add("splash-fade");
  }

  // Fixed timeout, not transitionend: several properties transition and the
  // first transitionend would cut the glide short.
  window.setTimeout(() => splash.remove(), DISMISS_MS + 100);
}

/** Dismiss after the next paint and the minimum display time, whichever is later. */
export function dismissSplash(dismissal: SplashDismissal = {}): void {
  const elapsed =
    typeof performance !== "undefined" ? performance.now() - splashShownAt : MIN_SPLASH_MS;
  const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        // Re-measure at dismissal time — the layout may have settled since.
        const targetElement = dismissal.target
          ? undefined
          : (document.querySelector("[data-splash-target]") as HTMLElement | null);
        runDismiss(dismissal.target ?? targetElement?.getBoundingClientRect() ?? undefined);
      }, wait);
    });
  });
}
