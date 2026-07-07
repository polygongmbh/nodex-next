# Nostr extensions and conventions used by Nodex

Survey of everything in the Nodex ecosystem (nodex, nodex-next, mostr) that
goes beyond plain NIP-01, with its standardization status. Items marked
**needs NIP** should be written up and proposed upstream; items marked
**remark** are conventions on top of existing NIPs that deserve documentation
but no new NIP.

## Shared topics — kind 30177 — **needs NIP (drafted)**

Named, composable channel combinations shared across all users of a relay.
Full draft in [nip-topics.md](./nip-topics.md). Novel elements worth
upstream discussion: cross-author replacement per `d` (relay-communal
namespace) and the primary/secondary ordering of `t` tags.

## Tasks and state updates — kinds 1621, 1630–1633 — **remark (NIP-34 divergence)**

Inherited from mostr. The kind numbers come from NIP-34 (git stuff), where
1621 is an *issue* and 1630–1633 are status events (open / applied / closed /
draft). Nodex reuses them as generic *tasks*:

- 1621: task (content = task text; channels via `t` tags like any post)
- 1630/1633: open — or **active/in-progress when the content is non-empty**;
  the content doubles as a free-form status label (e.g. "Review")
- 1631: done, 1632: closed
- State events reference the task via `e` tag and fold into it newest-first;
  they are never rendered as standalone posts (nodex-next renders compact
  rows, which is presentation, not data).

The content-as-status-label and "1633 = reopen" semantics diverge from
NIP-34's "draft" and should be documented upstream or moved to dedicated
kinds if interop with git clients ever matters.

## Reply threading — `e` tag marker `parent` — **remark**

NIP-10 defines `reply`/`root` markers. Nodex prefers a `parent` marker
(`["e", <id>, <relay-hint>, "parent"]`) and falls back to `reply`. Writing
`parent` is a deliberate deviation (one unambiguous pointer instead of
root+reply bookkeeping) and should be flagged in any interop doc.

## Presence — kind 30315 (NIP-38) — **remark**

nodex publishes user presence as NIP-38 user statuses (kind 30315),
relay-scoped: presence published only to the relays whose spaces the user is
active in, and interpreted per-relay by the sidebar people list. NIP-38
compliant on the wire; the relay-scoped interpretation is a Nodex convention
worth a remark.

## Media attachments — imeta (NIP-92) / NIP-94-style tags — **remark**

On publish, Nodex turns body media URLs into `imeta` tags (an intentional
contract carried over from nodex). On parse, posts collect attachments from
`imeta` tags (space-separated `url` / `m` / `x` / `size` entries) plus a
single NIP-94-style attachment from top-level `url`/`m`/`x`/`size` tags.

## Calendar events — kinds 31922/31923 (NIP-52) — **remark**

Standard NIP-52 date-based/time-based calendar events, addressable per
`(pubkey, d)` (NOT relay-communal like topics). Nodex conventions: `title`
falls back to the first content line, channels derive from `t` tags ∪
content hashtags like any post, and the CalDav bridge consumes these events
for the "post an event → calendar sync" flow.

## Channels are hashtags — **remark**

No NIP-28 channels. A post's channels are its `t` tags ∪ in-content
`#hashtags`, lowercased (NIP-24 `t` tags). Posting requires ≥1 channel.
Purely conventional, but central to interop expectations between Nodex
clients.

## Case-insensitive tag names on ingest (`T`/`P`/`E`) — **remark**

Inherited from nodex (commit "normalize nostr mention/tag parsing on
ingest"): tag NAMES are compared case-insensitively when reading, so `T`
counts as a channel tag, `P` as a mention, `E` as a deletion target. This is
pure liberal-input robustness against clients that uppercase tag names — it
carries NO NIP-22 root/parent semantics (NIP-22's uppercase tags live on
kind-1111 comments, which Nodex does not ingest, so there is no collision).
Writing always uses lowercase tag names.

## Noas discovery — `.well-known/nostr.json` `noas` extension — **needs documentation**

Noas (username+password custodial key server) extends the NIP-05 well-known
document with a top-level `noas` object:

```json
{ "noas": { "api_base": "/api/v1", "email_verification_mode": "optional", "relays": ["wss://tasks.example.com"] } }
```

`relays` (optional) lists the tenant's default spaces so a client can adopt a
space with no per-account configuration. Endpoints (`/auth/signin`,
`/auth/register`, `/picture/<pubkey>`) exchange a sha256 `password_hash` and a
NIP-49 `ncryptsec` private key that is only ever decrypted client-side. This
is a distinct protocol riding on the NIP-05 document and deserves its own spec
document in the noas repository.

## Per-relay attribution — **client behavior, no NIP needed**

Every event tracks which relays delivered it (union across duplicates), and
UI surfaces it (attribution dots, per-space scoping, replies pinned to the
parent's origin relay). This is client-side bookkeeping over standard NIP-01
behavior — no protocol change involved, but it constrains implementations:
caches that dedupe by event id and drop the delivering relay (e.g. stock NDK
caches) cannot serve Nodex.
