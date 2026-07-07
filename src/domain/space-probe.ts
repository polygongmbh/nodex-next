// Pure derivation of space-probe candidates from a noas host. When neither the
// account nor noas discovery supplies a relay, a client probes these candidate
// URLs (a WebSocket open, done in infrastructure) under the ROOT DOMAIN of the
// noas server and adopts the first that is reachable. Contract + cases:
// spec/vectors/space-detection.json.

/**
 * The registrable root domain a space would live under, or null when the host
 * is unusable (localhost, an IP, or a single label). Scheme, port, path and a
 * trailing dot are stripped; a host with 3+ labels drops its leftmost label
 * (so `mail.acme.com` and `tasks.acme.com` both reduce to `acme.com`).
 */
export function deriveProbeRoot(host: string): string | null {
  const raw = host.trim().toLowerCase();
  if (!raw) return null;
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const hostPortPath = withoutScheme.split("/")[0];
  const bareHost = hostPortPath.split(":")[0].replace(/\.$/, "");
  if (!bareHost || bareHost === "localhost") return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bareHost)) return null;
  const labels = bareHost.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  return (labels.length >= 3 ? labels.slice(1) : labels).join(".");
}

/**
 * Ordered `wss://<subdomain>.<root>` candidates for the given host. Subdomains
 * are lowercased, blanks skipped, duplicates collapsed; empty when the host has
 * no usable root or no subdomains are configured.
 */
export function spaceProbeCandidates(host: string, subdomains: string[]): string[] {
  const root = deriveProbeRoot(host);
  if (!root) return [];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const subdomain of subdomains) {
    const normalized = subdomain.trim().toLowerCase();
    if (!normalized) continue;
    const url = `wss://${normalized}.${root}`;
    if (seen.has(url)) continue;
    seen.add(url);
    candidates.push(url);
  }
  return candidates;
}
