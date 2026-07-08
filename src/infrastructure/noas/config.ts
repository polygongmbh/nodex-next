// The noas host used when a plain username (no @domain) signs in or registers.
// A single build-time flag, VITE_NOAS_HOST_URL, selects between three modes:
//   - unset            → the flagship default (`nodex.nexus`)
//   - empty string     → the deployment's own registrable root domain (a client
//                        served from `tasks.acme.com` uses `acme.com`), so a fork
//                        can point plain usernames at its own noas without naming
//                        the domain twice; falls back to the flagship when the
//                        deployment host has no usable root (localhost/IP/single
//                        label, e.g. `npm run dev`).
//   - any other value  → that host verbatim (a hardcoded per-deployment host).
// A `user@domain` username always picks its own host and ignores this.

import { deriveProbeRoot } from "@/domain/space-probe";

export const FLAGSHIP_NOAS_HOST = "nodex.nexus";

/**
 * Resolve the default noas host from the build-time override and the deployment
 * domain. Pure; see the mode table above. `override` is the raw
 * `VITE_NOAS_HOST_URL` value (undefined when the flag is unset); `deploymentHost`
 * is the client's own hostname (undefined outside a browser).
 */
export function resolveDefaultNoasHost(
  override: string | undefined,
  deploymentHost: string | undefined
): string {
  if (override === undefined) return FLAGSHIP_NOAS_HOST;
  const trimmed = override.trim();
  if (trimmed) return trimmed;
  // Empty override: adopt the deployment's root domain when it has a usable one.
  const root = deploymentHost ? deriveProbeRoot(deploymentHost) : null;
  return root ?? FLAGSHIP_NOAS_HOST;
}

export const DEFAULT_NOAS_HOST = resolveDefaultNoasHost(
  import.meta.env.VITE_NOAS_HOST_URL as string | undefined,
  typeof window !== "undefined" ? window.location.hostname : undefined
);
