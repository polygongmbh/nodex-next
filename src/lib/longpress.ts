// Svelte action: fire a callback on long-press (touch hold) or right-click
// (desktop), suppressing the click that would otherwise follow.

const LONG_PRESS_MS = 450;

export function longpress(node: HTMLElement, callback: () => void) {
  let current = callback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;

  function down() {
    fired = false;
    timer = setTimeout(() => {
      fired = true;
      current();
    }, LONG_PRESS_MS);
  }
  function cancel() {
    clearTimeout(timer);
  }
  function suppressClick(event: MouseEvent) {
    if (!fired) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    fired = false;
  }
  function contextmenu(event: MouseEvent) {
    event.preventDefault();
    clearTimeout(timer);
    fired = true;
    current();
  }

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointerup", cancel);
  node.addEventListener("pointerleave", cancel);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("click", suppressClick, true);
  node.addEventListener("contextmenu", contextmenu);

  return {
    update(next: () => void) {
      current = next;
    },
    destroy() {
      clearTimeout(timer);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointerup", cancel);
      node.removeEventListener("pointerleave", cancel);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("click", suppressClick, true);
      node.removeEventListener("contextmenu", contextmenu);
    },
  };
}
