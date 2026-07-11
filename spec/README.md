# Nodex cross-client spec vectors

Language-neutral test vectors that pin down the behavior every Nodex client
(nodex-next web, nodex-talk mobile, future clients) must implement
identically. The prose spec lives in `../docs/rebuild-prompt.md` and the
protocol docs; these files are its machine-digestible half. **Behavior
changes land here first**, then in each client.

## How to consume

Write a thin adapter per client (~50 lines each) that loads each JSON file
and asserts through your own domain layer — see `src/test/vectors-*.test.ts`
in this repo for the reference adapters, and port the same mapping to
`flutter test`.

Conventions:

- Event ids and pubkeys in vectors are **opaque symbolic strings**
  ("root", "alice") — no client may validate id shape in the domain layer.
  The exceptions are crypto vectors (`noas.json`), which use real keys.
- Timestamps are unix seconds; `now`/`date` in timestamp vectors are ISO
  strings interpreted in LOCAL time (bucket logic is calendar-based).
- Expected errors are the stable `error.*` message keys — clients use the
  same keys as their error identifiers (and translate them at render time).
- Unknown fields in a vector case are additions; adapters should fail on
  unknown EXPECTATION fields so new assertions can't be silently skipped.

## Files

| File | Contract |
| --- | --- |
| `channels.json` | hashtag extraction, hex-color exclusion, t-tag ∪ content channel derivation |
| `content-tokens.json` | content tokenizing into text/url/hashtag runs |
| `relay-identity.json` | relay URL normalization, id derivation, display name (prefix/TLD stripping) |
| `timestamps.json` | timestamp bucket decision (time / yesterday / monthDay / shortDate) |
| `topic-identity.json` | canonical channel-set topic ids, topic event build/parse (kind 30177) |
| `classify-events.json` | raw event → post/person/topic/state/deletion classification |
| `publish-rules.json` | single-relay publish targeting, reply pinning, message tags, draft channels, reaction/deletion tags, target-relay resolution for reactions and deletions |
| `permalinks.json` | shareable post link derivation (`origin/relayHost/eventId`, active-space preference) |
| `noas.json` | credential splitting, sign-in response parsing (aliases, errors), NIP-49 decrypt, profile content merging, default display name from username |
| `space-detection.json` | ordered wss:// space-probe candidates derived from a noas host (root-domain reduction, subdomain expansion) |
| `ingest-scenarios.json` | store semantics: attribution union, fold preservation, tombstones, pending folds, newest-kind-0, topic replacement/deletion, reaction aggregation/toggle-by-deletion |
| `timeline-scope.json` | visible timeline derivation: AND filters, excludes, pinned default scope, relay scope, search, thread focus, ordering |

## Versioning

Vectors only grow; changing an existing expectation is a breaking spec
change and needs a matching entry in both clients' changelogs. Cases carry a
`name` — keep names stable, they are the cross-repo reference.
