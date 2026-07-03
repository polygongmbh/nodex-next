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
    ["d", "<slug of the name, lowercase>"],
    ["title", "<display name>"],
    ["t", "<primary channel>"],
    ["t", "<secondary channel>", "..."]
  ]
}
```

- `d` is a stable, lowercase slug of the topic name (non-alphanumeric runs
  collapsed to `-`). It makes the event addressable: republishing under the
  same `d` refines the topic.
- `title` carries the display name. If absent, clients render the `d` value.
- The **first `t` tag is the primary channel**; all further `t` tags are
  secondary. At least one `t` tag is REQUIRED. All `t` values are lowercase
  hashtags without `#`, exactly as in posts (NIP-24 `t` tags).

Client behavior
---------------

- Topics are **relay-communal**: clients subscribe to kind `30177` without an
  author filter and resolve conflicts by `d` alone — the newest `created_at`
  per `d` wins **across authors**, so anyone on the space can refine a topic.
  (This deliberately extends the usual per-`(kind, pubkey, d)` addressable
  replacement: the relay's community, not the author, owns the namespace.)
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
