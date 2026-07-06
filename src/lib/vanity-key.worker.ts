// Web worker running the vanity-key mining loop off the main thread.
// Cancellation = the host terminates the worker.

import { mineVanityKey } from "./vanity-key";

self.onmessage = (event: MessageEvent<{ target: string; maxAttempts?: number }>) => {
  const { target, maxAttempts } = event.data;
  const mined = mineVanityKey(target, maxAttempts);
  self.postMessage(mined);
};
