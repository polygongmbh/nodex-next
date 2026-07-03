NIP-XXX (draft)
======

Shared Topics
-------------

`draft` `optional`

Kind `30177` (addressable, provisional number) defines a **topic**: a named,
composable combination of hashtag channels, shared by all users of a relay.

Motivation
----------

Team spaces need finer contexts than flat hashtag channels, but sub-channels
fragment conversations the same way rigid folder hierarchies fragment
documents. A topic instead *composes* existing channels: "Nodex User Stories"
is `#design` + `#nodex`. One piece of information keeps living in multiple
places; a topic is only a shared, named lens over tags. Because a topic is an
event on the relay, every member of that space sees the same topics — unlike
mute/pin lists (NIP-51), which are personal.

Event format
------------

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

- **A topic is identified by the set of channels it contains, not by its
  name.** A topic is nothing more than a named lens over the posts carrying
  its channels — the same selection of channels contains the same posts,
  ergo it IS the same topic; a second name over the same set could never
  show different content. `d` MUST therefore be the canonical encoding of
  the set: the deduplicated, lowercase channel names sorted
  lexicographically and joined with `+` (e.g. `design+nodex+persona`).
  Republishing the same channel set — regardless of name or `t`-tag order —
  addresses the same topic, so renaming is just a newer event, and
  independent authors describing the same combination converge on one
  topic. To split a topic into distinct conversations, add a distinguishing
  channel (`#dev`+`#nodex`+`#bugs` vs `#dev`+`#nodex`+`#ideas`) — which
  keeps the distinction visible to plain-hashtag clients too.
- `title` carries the display name. If absent, clients render the channel
  list. Names need not be unique and are not identity.
- The **first `t` tag is the primary channel**; all further `t` tags are
  secondary. Ordering is a navigation hint only — it does not affect
  identity. At least one `t` tag is REQUIRED. All `t` values are lowercase
  hashtags without `#`, exactly as in posts (NIP-24 `t` tags).
- Clients SHOULD derive the identity from the `t` tags rather than trusting
  `d`, so malformed events still group correctly; relays, however, replace
  by `d`, which is why writing the canonical form is mandatory.

Client behavior
---------------

- Topics are **relay-communal**: clients subscribe to kind `30177` without an
  author filter and resolve conflicts by channel set alone — the newest
  `created_at` per set wins **across authors**, so anyone on the space can
  refine or rename a topic. (This deliberately extends the usual
  per-`(kind, pubkey, d)` addressable replacement: the relay's community,
  not the author, owns the namespace.)
- Selecting a topic filters the feed to posts carrying **all** of its
  channels, and posts composed inside the topic MUST carry all of its
  channels as `t` tags. This keeps topic conversations fully visible to
  clients that only understand hashtags.
- The primary channel is a hint for navigation: clients SHOULD list a topic
  under its primary channel and MAY auto-select the primary channel when a
  topic is selected without channel context. Under any *selected* channel,
  clients SHOULD surface every topic containing that channel.
- Personal state (pinning, hiding) is NOT part of the event; clients keep it
  locally or in NIP-78 application data.
- Deletion follows NIP-09 and therefore only removes the author's own
  definition; a topic by another author is superseded by publishing a newer
  event with the same `d`.

Relay scope
-----------

A topic belongs to the relay(s) it is published on. Clients treating relays
as separate spaces SHOULD publish new topics to the currently active space,
or to all connected spaces when none is active.
