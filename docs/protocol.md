# Nodal / Nodex protocol and wire semantics

Single normative home for every protocol and wire fact shared across the
Nodex clients (nodex-next, nodex-talk) and interoperable with the original
nodex and mostr on the same relay.
Everything in the ecosystem that goes beyond plain NIP-01 lives here;
prompts and READMEs link into this file rather than restating it.

Standardization status of each convention is tagged:

- **needs NIP** — should be written up and proposed upstream.
- **remark** — a convention on top of an existing NIP;
  deserves documentation but no new NIP.
- **client behavior** — bookkeeping over standard NIP behavior;
  no protocol change involved.

## Event kinds

| Kind | Meaning | Basis |
| --- | --- | --- |
| 0 | Profile metadata | NIP-01 |
| 1 | Message (post) | NIP-01 |
| 5 | Deletion | NIP-09 |
| 7 | Reaction | NIP-25 |
| 1111 | Comment (replies under non-kind-1 roots) | NIP-22 |
| 1621 | Task | NIP-34 kind reused (remark below) |
| 1630 / 1633 | Task state: open — or active when content is non-empty | NIP-34 kind reused (remark below) |
| 1631 | Task state: done | NIP-34 kind reused (remark below) |
| 1632 | Task state: closed | NIP-34 kind reused (remark below) |
| 30177 | Shared topic (addressable) | needs NIP (drafted below) |
| 30315 | User presence / status | NIP-38 |
| 31922 / 31923 | Date-based / time-based calendar event | NIP-52 |

Kinds 1633 ("Procedure") and 1639 exist only in the legacy mostr-cli and are
NOT implemented in any client.

## Channels are hashtags — **remark**

There are no NIP-28 channels.
A post's channels are its `t` tags ∪ its in-content `#hashtags`,
lowercased (NIP-24 `t` tags).
Color tokens are NOT hashtags: an UPPERCASE hex or digit-only run of length
3/4/6/8 (`#FEE`, `#123`) is a color and excluded, whereas lowercase `#fee`
is a channel.
Posting requires ≥1 channel.
Purely conventional, but central to interop expectations between Nodex
clients.

**Spaces are relays.**
An empty space selection means "All spaces", never "no relays";
"All spaces" ≠ "no relays".

## Reply threading — **remark**

Threading form depends on the thread ROOT's kind.

**Under a kind-1 message — NIP-10 kind-1 reply.**
NIP-10 defines `reply`/`root` markers.
Nodex prefers a `parent` marker (`["e", <id>, <relay-hint>, "parent"]`)
and falls back to `reply`.
Writing `parent` is a deliberate deviation
(one unambiguous pointer instead of root+reply bookkeeping)
and should be flagged in any interop doc.
On write: a single `root`-marked `e`-tag for a top-level reply,
`root`+`reply` for a nested one, plus participant `p`-tags.

**Under ANY other root (task, calendar event, or a comment whose root is one
of those) — NIP-22 kind-1111 comment.**
Uppercase `E`/`A` + `K` + `P` carry the root scope
(an `A` address for an addressable root),
lowercase `e`(+`a`) + `k` + `p` carry the immediate parent.
Ingest threads a comment on its lowercase `e`-tag and DROPS comments without
one (i-tag-only external scopes).
Comments render as post cards and carry channels as `t`-tags like any post.

Replies pin to the parent's origin relay (the first of the parent's relays).

## Tasks and state updates — kinds 1621, 1630–1633 — **remark (NIP-34 divergence)**

Inherited from mostr.
The kind numbers come from NIP-34 (git), where 1621 is an *issue* and
1630–1633 are status events (open / applied / closed / draft).
Nodex reuses them as generic *tasks*:

- 1621: task (content = task text; channels via `t` tags like any post).
- 1630/1633: open — or **active/in-progress when the content is non-empty**;
  the content doubles as a free-form status label (e.g. "Review").
- 1631: done, 1632: closed.
- State events reference the task via `e` tag and fold into it newest-first
  (dedupe by event id);
  they are never rendered as standalone posts
  (clients render compact rows, which is presentation, not data).

The content-as-status-label and "1633 = reopen" semantics diverge from
NIP-34's "draft" and should be documented upstream or moved to dedicated
kinds if interop with git clients ever matters.

## Reactions — kind 7 (NIP-25) — **remark**

Reactions are NIP-25 kind-7 events published to every connected relay that
delivered the target (never a composer target).
Content is `+` for 👍 and `-` for 👎, else the emoji verbatim.
Tags: `e` (id, relay hint, author) + `p` + `k`, where `k` is the TARGET's
kind (kind-1 semantics for posts, 31922/31923 for calendar events).
Newest reaction wins per reactor;
reacting with the same emoji again toggles it OFF via the reactor's own
kind-5 deletion of the prior reaction (`e` + `k 7`),
while a different emoji just publishes anew.

## Shared topics — kind 30177 — **needs NIP (drafted)**

Kind `30177` (addressable, provisional number) defines a **topic**:
a named, composable combination of hashtag channels,
shared by all users of a relay.
Novel elements worth upstream discussion:
cross-author replacement per `d` (relay-communal namespace)
and the primary/secondary ordering of `t` tags.

### Motivation

Team spaces need finer contexts than flat hashtag channels,
but sub-channels fragment conversations the same way rigid folder
hierarchies fragment documents.
A topic instead *composes* existing channels:
"Nodex User Stories" is `#design` + `#nodex`.
One piece of information keeps living in multiple places;
a topic is only a shared, named lens over tags.
Because a topic is an event on the relay,
every member of that space sees the same topics —
unlike mute/pin lists (NIP-51), which are personal.

### Event format

```json
{
  "kind": 30177,
  "content": "<optional human-readable description>",
  "tags": [
    ["d", "<canonical channel-set encoding>"],
    ["title", "<display name>"],
    ["t", "<primary channel>"],
    ["t", "<secondary channel>", "..."]
  ]
}
```

### Identity

- **A topic is identified by the set of channels it contains, not by its
  name.**
  A topic is nothing more than a named lens over the posts carrying its
  channels —
  the same selection of channels contains the same posts,
  ergo it IS the same topic;
  a second name over the same set could never show different content.
  `d` MUST therefore be the canonical encoding of the set:
  the deduplicated, lowercase channel names sorted lexicographically and
  joined with `+` (e.g. `design+nodex+persona`).
  Republishing the same channel set — regardless of name or `t`-tag order —
  addresses the same topic,
  so renaming is just a newer event,
  and independent authors describing the same combination converge on one
  topic.
  To split a topic into distinct conversations, add a distinguishing channel
  (`#dev`+`#nodex`+`#bugs` vs `#dev`+`#nodex`+`#ideas`) —
  which keeps the distinction visible to plain-hashtag clients too.
- `title` carries the display name.
  If absent, clients render the channel list.
  Names need not be unique and are not identity.
- The **first `t` tag is the primary channel**;
  all further `t` tags are secondary.
  Ordering is a navigation hint only — it does not affect identity.
  At least one `t` tag is REQUIRED.
  All `t` values are lowercase hashtags without `#`,
  exactly as in posts (NIP-24 `t` tags).
- Clients SHOULD derive the identity from the `t` tags rather than trusting
  `d`, so malformed events still group correctly;
  relays, however, replace by `d`,
  which is why writing the canonical form is mandatory.

### Client behavior

- Topics are **relay-communal**:
  clients subscribe to kind `30177` without an author filter and resolve
  conflicts by channel set alone —
  the newest `created_at` per set wins **across authors**,
  so anyone on the space can refine or rename a topic.
  (This deliberately extends the usual per-`(kind, pubkey, d)` addressable
  replacement: the relay's community, not the author, owns the namespace.)
- Selecting a topic filters the feed to posts carrying **all** of its
  channels,
  and posts composed inside the topic MUST carry all of its channels as `t`
  tags.
  This keeps topic conversations fully visible to clients that only
  understand hashtags.
- The primary channel is a hint for navigation:
  clients SHOULD list a topic under its primary channel and MAY auto-select
  the primary channel when a topic is selected without channel context.
  Under any *selected* channel, clients SHOULD surface every topic containing
  that channel.
- Personal state (pinning, hiding) is NOT part of the event;
  clients keep it locally or in NIP-78 application data.
- Deletion follows NIP-09 and therefore only removes the author's own
  definition;
  a topic by another author is superseded by publishing a newer event with
  the same `d`.

### Relay scope

A topic belongs to the relay(s) it is published on.
Clients treating relays as separate spaces SHOULD publish new topics to the
currently active space,
or to all connected spaces when none is active.

## Presence — kind 30315 (NIP-38) — **remark**

Presence is published as NIP-38 user statuses (kind 30315), relay-scoped:
presence is published only to the relays whose spaces the user is active in,
and interpreted per-relay by the sidebar people list.
NIP-38 compliant on the wire;
the relay-scoped interpretation is a Nodex convention worth a remark.

## Media attachments — imeta (NIP-92) / NIP-94-style tags — **remark**

On publish, Nodex turns body media URLs into `imeta` tags
(an intentional contract carried over from nodex).
On parse, posts collect attachments from `imeta` tags
(space-separated `url` / `m` / `x` / `size` entries)
plus a single NIP-94-style attachment from top-level `url`/`m`/`x`/`size`
tags.

## Calendar events — kinds 31922/31923 (NIP-52) — **remark**

Standard NIP-52 date-based/time-based calendar events,
addressable per `(pubkey, d)` (NOT relay-communal like topics).
Nodex conventions:
`title` falls back to the first content line,
channels derive from `t` tags ∪ content hashtags like any post,
and the CalDav bridge consumes these events for the "post an event →
calendar sync" flow.

## Case-insensitive tag names on ingest (`T`/`P`/`E`) — **remark**

Inherited from nodex (commit "normalize nostr mention/tag parsing on
ingest"):
tag NAMES are compared case-insensitively when reading,
so `T` counts as a channel tag, `P` as a mention, `E` as a deletion target.
This is pure liberal-input robustness against clients that uppercase tag
names —
it carries NO NIP-22 root/parent semantics
(NIP-22's uppercase tags live on kind-1111 comments,
which Nodex ingests only via the lowercase `e`-tag threading above,
so there is no collision).
Writing always uses lowercase tag names.

## Deletions — kind 5 (NIP-09) — **remark**

A kind-5 deletion tombstones only the author's OWN events;
it never removes another author's event.
Deleted ids never resurrect on re-ingest.
On write, a deletion carries `e` (+ `a` coordinate for an addressable target
such as a calendar event) + `k` tags and is published to every connected
relay that delivered the target.

## Publishing targets — **client behavior**

- A post MUST carry ≥1 channel (written as lowercased `t` tags).
- New posts target exactly ONE relay:
  the active space, else the sole connected relay, else a readable error.
- Replies pin to the parent's origin relay (the first of its relays).
- Kind-0 profiles publish to ALL session relays,
  or to a single relay for per-space profiles.
- Reactions and deletions publish to every connected relay that delivered the
  target (see those sections).

## Per-relay attribution — **client behavior, no NIP needed**

Every event tracks which relays delivered it (union across duplicates),
and the UI surfaces it (attribution dots, per-space scoping,
replies pinned to the parent's origin relay).
This is client-side bookkeeping over standard NIP-01 behavior —
no protocol change involved, but it constrains implementations:
caches that dedupe by event id and drop the delivering relay
(e.g. stock NDK caches) cannot serve Nodex.
Client-specific mechanics for achieving this (JS-NDK `event`/`event:dup`
union-merge; dart-ndk per-relay subscriptions) live in each client's own
notes, not here.

## Noas discovery — `.well-known/nostr.json` `noas` extension — **needs documentation**

Noas (the username+password custodial key server) extends the NIP-05
well-known document with a top-level `noas` object:

```json
{ "noas": { "api_base": "/api/v1", "email_verification_mode": "optional", "relays": ["wss://tasks.example.com"] } }
```

`relays` (optional) lists the tenant's default spaces
so a client can adopt a space with no per-account configuration.
Endpoints (`/auth/signin`, `/auth/register`, `/auth/update`,
`/picture/<pubkey>`) exchange a sha256 `password_hash` and a NIP-49
`ncryptsec` private key that is only ever decrypted client-side.
Avatars are the one media path:
uploaded as base64 `profile_picture_data` on `/auth/register` or
`/auth/update` and served at `/picture/<pubkey>` —
there is no Blossom/NIP-96 endpoint.
This is a distinct protocol riding on the NIP-05 document and deserves its
own spec document in the noas repository.
The client-facing auth flow (aliases, verification, session persistence,
space auto-detection) is specified in
[rebuild-prompt.md](./rebuild-prompt.md) § Noas auth.
