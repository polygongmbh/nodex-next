// Vanity-key miner lifecycle for the sign-in/register screen: owns the web
// worker and the `mining` UI state, and drives nodex's auto-mining while the
// user types a username. Coupled to the screen's key-input via the getter/
// setter callbacks so a mined key never clobbers one the user typed/pasted.

import { vanityTargetFromUsername } from "@/lib/vanity-key";

export interface VanityMinerOptions {
  /** Whether the screen is in register mode (auto-mining only runs there). */
  isRegistering: () => boolean;
  /** The username whose initials seed the vanity target. */
  getUsername: () => string;
  /** The current key-input value; a typed key suppresses auto-mining. */
  getKeyInput: () => string;
  /** Fill the key input with a freshly mined secret. */
  setKeyInput: (secretHex: string) => void;
}

export interface VanityMiner {
  readonly mining: boolean;
  /** Explicit user request to mine (the "generate" button). */
  generate: () => void;
}

export function createVanityMiner(options: VanityMinerOptions): VanityMiner {
  let miner: Worker | null = null;
  let mining = $state(false);

  function stopMiner() {
    miner?.terminate();
    miner = null;
    mining = false;
  }

  function startMining(target: string, fillIfTyped: boolean) {
    stopMiner();
    mining = true;
    miner = new Worker(new URL("./vanity-key.worker.ts", import.meta.url), {
      type: "module",
    });
    miner.onmessage = (event: MessageEvent<{ secretHex: string } | null>) => {
      const mined = event.data;
      // Never clobber a key the user typed/pasted in the meantime.
      if (mined && (fillIfTyped || !options.getKeyInput().trim())) options.setKeyInput(mined.secretHex);
      stopMiner();
    };
    miner.postMessage({ target });
  }

  // why: nodex's auto-mining — once the username has ≥4 chars and no key was
  // provided, mine a vanity key whose npub starts with the user's initials.
  $effect(() => {
    if (!options.isRegistering()) return;
    const local = options.getUsername().split("@")[0];
    if (local.length < 4 || options.getKeyInput().trim() || mining) return;
    const timer = setTimeout(() => startMining(vanityTargetFromUsername(local), false), 500);
    return () => clearTimeout(timer);
  });

  return {
    get mining() {
      return mining;
    },
    generate() {
      const username = options.getUsername();
      if (mining) {
        // Impatient re-click: settle for a shorter prefix, faster.
        startMining(vanityTargetFromUsername(username, 2) || "0", true);
        return;
      }
      startMining(vanityTargetFromUsername(username) || "0", true);
    },
  };
}
