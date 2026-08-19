# Simplecast API — reference notes

Source of truth for this document: **Simplecast's official Postman collection** ("Simplecast API", published at https://apidocs.simplecast.com/), as uploaded by the maintainer. Every endpoint, method, and query parameter below is transcribed from that collection's request definitions — nothing here is inferred from third-party connectors or docs-site prose, except where explicitly marked. This is the deep-dive doc — read it when you need exact endpoint paths, param shapes, or error meanings rather than the tool-level workflow guidance in `../SKILL.md`.

## Base URL & auth

- Base URL: `https://api.simplecast.com`
- Auth: HTTP Bearer — `authorization: Bearer <token>`, token from env `SIMPLECAST_API_TOKEN`.
- Token source: Simplecast dashboard → account → **Private Apps** page.
- If the token is missing, the server still starts (tools list fine) but every call fails with a message pointing back to the Private Apps page.

## Pagination

List endpoints accept `limit` and `offset` query params (default `limit=10`, `offset=0` per the collection). Response envelope:

```json
{
  "collection": [ /* items */ ],
  "pages": { /* paging metadata, e.g. total/next/prev */ }
}
```

To page through a full collection, increase `offset` by the page size until `collection` is shorter than `limit` or empty.

## Hypermedia design

Simplecast responses are self-describing: they include `href` links to related resources and, for analytics, to every report available for that resource on the caller's plan.

`GET /analytics?podcast={id}` or `?episode={id}` is the hub: its response lists hrefs for whichever reports actually exist for that podcast/episode given the account's plan. Prefer following those hrefs (via the `simplecast_get` tool) over assuming a report exists.

## Endpoints

All endpoints below are confirmed directly from the Postman collection (62 total request definitions). Query params are transcribed from each request's parameter table; `*` in the collection marks a required param, shown here as **required**. Dates are ISO (`YYYY-MM-DD` works for `start_date`/`end_date`).

### Analytics

| Method & path | Scope / required | Optional params (per collection) | Notes |
|---|---|---|---|
| `GET /analytics` | `podcast` **or** `episode` (required, uuid) | — | Hypermedia hub — links to every report available for that resource/plan. |
| `GET /analytics/campaigns/{campaign_id}` | `campaign` **required** (path, uuid) | `start_date`, `end_date`, `interval` (day/week/month), `email` | Ad campaign analytics. |
| `GET /analytics/downloads` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `interval`, `sort` (asc/desc), `email` | Download counts over time. |
| `GET /analytics/embed` | `podcast` **or** `episode` (required) | — | Web Player (embed) hub — links to embed sub-reports. |
| `GET /analytics/embed/episodes` | `podcast` **required** | `episodes` (comma-separated episode UUIDs filter), `start_date`, `end_date`, `interval`, `limit`, `offset`, `sort`, `email` | Embed analytics per episode for a podcast. |
| `GET /analytics/embed/listens` | `podcast` **required** (podcast-only) | `start_date`, `end_date`, `interval`, `sort`, `email` | Embed listen counts. Podcast-only per its description text ("...for a given Podcast"), even though the param table's `episode *` row would suggest either scope — see ambiguity note below. |
| `GET /analytics/embed/locations` | `podcast` **required** (podcast-only) | `start_date`, `end_date`, `limit`, `offset`, `sort`, `email` | Embed geographic breakdown. Podcast-only per its description text, even though the param table's `episode *` row would suggest either scope — see ambiguity note below. |
| `GET /analytics/embed/speeds` | `podcast` **required** (podcast-only) | `start_date`, `end_date`, `email` | Playback speed distribution (0.5x–2.0x). Podcast-only per its description text, even though the param table's `episode *` row would suggest either scope — see ambiguity note below. |
| `GET /analytics/embed/avg_completion` | `episode` **required** | `start_date`, `end_date`, `sort` | Average completion %, episode-scoped only (no `podcast` param in the collection). |
| `GET /analytics/embed/heatmap` | `episode` **required** | `start_date`, `end_date` | Listener drop-off heatmap, episode-scoped only (no `podcast` param in the collection). |
| `GET /analytics/episodes` | `podcast` **required** | `episodes` (comma-separated filter), `start_date`, `end_date`, `interval`, `sort`, `limit`/`offset` (paginated), `email` | Per-episode rollup for a show. |
| `GET /analytics/episodes/average_downloads` | `podcast` **required** | — (no dates documented) | Average episode downloads for a show. |
| `GET /analytics/episodes/hours_listened` | `podcast` **required** | — (no dates documented) | Total hours listened for a show. |
| `GET /analytics/episodes/listeners` | `podcast` **required** | `episodes` (filter), `start_date`, `end_date`, `interval` (only respected when `email=true`), `sort`, `email` | Unique listeners grouped by episode. |
| `GET /analytics/episodes/top_10` | `podcast` **required** | `start_date`, `end_date`, `email` | Top 10 episodes for a show. |
| `GET /analytics/listeners` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `interval`, `sort`, `email` | Unique listener counts. |
| `GET /analytics/listeners/last_7` | `podcast` **required** | — | Unique listeners, last 7 days, podcast-only. |
| `GET /analytics/location` | `podcast` **or** `episode` (required) | `country` (int), `state` (int), `start_date`, `end_date`, `sort`, `email` | Geographic breakdown; `country`/`state` narrow to one region. |
| `GET /analytics/podcasts/listeners` | `podcast` **required** | `start_date`, `end_date` | Total unique listeners, podcast-level. |
| `GET /analytics/technology` | `podcast` **or** `episode` (required) | — | Technology analytics hub. |
| `GET /analytics/technology/applications` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `email` | By application. |
| `GET /analytics/technology/browsers` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `email` | By browser. |
| `GET /analytics/technology/device_class` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `email` | By device class. |
| `GET /analytics/technology/devices` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `email` | By device. |
| `GET /analytics/technology/listening_methods` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `email` | By listening method (app, web player, etc.). |
| `GET /analytics/technology/network_types` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `email` | By network type. |
| `GET /analytics/technology/operating_systems` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `email` | By OS. |
| `GET /analytics/technology/providers` | `podcast` **or** `episode` (required) | `start_date`, `end_date`, `email` | By network/carrier provider. |
| `GET /analytics/technology/web_players` | podcast-only (implied by description; collection has no param table for this request) | — | Web player usage. Podcast-only per its description text ("...for a given Podcast"). |
| `GET /analytics/time_of_week` | `podcast` **required** | `start_date`, `end_date`, `email` | Listens by day/time of week. Podcast-only — the collection has no `episode` param for this endpoint. |

### Podcasts

| Method & path | Params (per collection) | Notes |
|---|---|---|
| `GET /podcasts` | `limit`, `offset`, `search` (by title), `status` (`draft`\|`published`), `type` (`serial`\|`episodic`\|`episodic_seasons`) | List podcasts on the account. |
| `GET /podcasts/{podcast_id}` | — | Single podcast + metadata. |
| `GET /podcasts/{podcast_id}/authors` | — | Authors added to the podcast. |
| `GET /podcasts/{podcast_id}/categories` | — | Categories added to the podcast. |
| `GET /podcasts/{podcast_id}/categories/{category_id}` | — | Single category on the podcast. |
| `GET /podcasts/{podcast_id}/categories/{category_id}/subcategories` | — | Subcategories under a category. |
| `GET /podcasts/{podcast_id}/categories/{category_id}/subcategories/{subcategory_id}` | — | Single subcategory. |
| `GET /podcasts/{podcast_id}/distribution_channels` | — | Distribution channels added to the podcast. |
| `GET /podcasts/{podcast_id}/distribution_channels/{distribution_channel_id}` | — | Single distribution channel on the podcast. |
| `GET /podcasts/{podcast_id}/episodes` | `limit`, `offset`, `search` (by title), `sort` (`title`\|`number`\|`custom_url`\|`published_at`\|`created_at`\|`updated_at`, each with optional `_asc`/`_desc` suffix; default `latest`), `status` (`importing`\|`audio_imported`\|`transcoding`\|`transcoding_error`\|`draft`\|`scheduled`\|`published`\|`private`), `type` (`full`\|`trailer`\|`bonus`) | Episodes for a show. |
| `GET /podcasts/{podcast_id}/keywords` | — | Keywords added to the podcast. |
| `GET /podcasts/{podcast_id}/keywords/{keyword_id}` | — | Single keyword on the podcast. |
| `GET /podcasts/{podcast_id}/rss` | — | RSS feed for the podcast. |
| `GET /podcasts/{podcast_id}/seasons` | — | Seasons on the podcast. |
| `POST /podcasts/{podcast_id}` | body: only the changed fields | **Mutating. Not present in the Postman collection.** Confirmed only via the docs site's (apidocs.simplecast.com) worked examples for partial-update of a podcast's metadata. Treat with the same caution as any endpoint not independently verified against the collection JSON — the shape of the request body is based on those documented examples, not a collection request definition. |

### Episodes

| Method & path | Params (per collection) | Notes |
|---|---|---|
| `GET /episodes/{episode_id}` | — | Single episode. |
| `GET /episodes/{episode_id}/authors` | — | Authors for the episode. |
| `GET /episodes/{episode_id}/keywords` | — | Keywords for the episode. |
| `GET /episodes/{episode_id}/keywords/{keyword_id}` | — | Single keyword on the episode. |
| `GET /episodes/{episode_id}/markers` | — | Chapter/ad markers for the episode. |
| `GET /episodes/{episode_id}/markers/{marker_id}` | — | Single marker. |
| `POST /episodes/{episode_id}/audio` | (multipart audio upload) | **Present in the collection but intentionally not exposed as an MCP tool.** Uploading audio is out of scope for this server; use the Simplecast dashboard for audio uploads. |

### Seasons

| Method & path | Params (per collection) | Notes |
|---|---|---|
| `GET /seasons/{season_id}` | — | Single season. |
| `GET /seasons/{season_id}/episodes` | `limit`, `offset`, `sort` (same values as podcast episodes list), `status` (same enum as podcast episodes list) | Episodes in a season. |

### Authors, categories, keywords, links, distribution channels

| Method & path | Params (per collection) | Notes |
|---|---|---|
| `GET /authors/{author_id}` | — | Single author. |
| `GET /categories` | — (no pagination params documented) | All Simplecast categories. |
| `GET /keywords/{keyword_id}` | — | Single keyword. |
| `GET /links/{link_id}` | — | Single link. |
| `GET /distribution_channels` | — (no pagination params documented) | All distribution channels; scope to a podcast via `GET /podcasts/{id}/distribution_channels` instead. |
| `GET /distribution_channels/{distribution_channel_id}` | — | Single distribution channel. |

### Account & misc

| Method & path | Params (per collection) | Notes |
|---|---|---|
| `GET /current_user` | — | Authenticated user + permissions. |
| `GET /timezones` | — | Supported timezones. |
| `GET /oembed` | `url` **required** (must be an episode's public site URL) | oEmbed metadata for embedding an episode. |

## Rate limits

No documented rate limit. Treat `429` defensively: surface `Retry-After` if the response includes it.

## Errors

| Status | Meaning | Handling |
|---|---|---|
| `401` | Invalid or expired token | Point the user back to Simplecast → Account → Private Apps to issue a fresh token. |
| `404` | Resource not found, or a plan/account doesn't have a given analytics report enabled | Double-check the id for resource endpoints; for analytics reports, fall back to `get_analytics_overview` to see what's actually exposed to you. |
| `429` | Rate limited | Back off; include `Retry-After` (if present) in the message back to the user. |

Error bodies from the API are surfaced truncated (~500 chars) alongside the status-based message.

## Where the collection and the tool surface diverge

Most query parameters documented in the collection (`interval`, `sort`, `country`, `state`, the `episodes` comma-list filter, `search`/`status`/`type` on `list_podcasts`, etc.) are exposed as typed tool arguments — see the README's tool table for the authoritative per-tool list. The one parameter deliberately left unexposed everywhere is `email` (send-as-CSV-to-your-inbox on almost every analytics endpoint): it doesn't return data to the caller, so it isn't useful as an MCP tool argument. Anything documented above but not in the README's tool table (including `email`) is still reachable via the `simplecast_get` escape hatch (pass the endpoint's `path` and the extra params under `query`).

One specific ambiguity: the collection's per-request parameter tables for `GET /analytics/embed/listens`, `/analytics/embed/locations`, and `/analytics/embed/speeds` each list **both** a `podcast *` row and an `episode *` row (both marked required-one-of), which reads like either scope is supported. But each request's prose description says the report is "for a given Podcast" only, with no episode-level equivalent documented elsewhere in the collection — the `episode *` table row looks like a templated artifact copied from the either-scope endpoints rather than a real capability. This server treats the prose as authoritative: `get_embed_analytics` scopes `report: "listens"`, `"locations"`, and `"speeds"` (and `"episodes"`) as podcast-only and will reject an `episode_id`. If you want to test whether episode scope actually works for one of these on your account/plan, call `simplecast_get` directly against the endpoint's path with `episode` in `query`.

## Tool-to-endpoint map

See the README's tool table for the authoritative list of tool names and params. Quick map for reference:

- `get_current_user` → `GET /current_user`
- `list_categories` → `GET /categories`
- `list_timezones` → `GET /timezones`
- `list_distribution_channels` → `GET /distribution_channels` or `GET /podcasts/{id}/distribution_channels`
- `list_podcasts` → `GET /podcasts`
- `get_podcast` → `GET /podcasts/{id}`
- `update_podcast` → `POST /podcasts/{id}` (mutating; see caveat above)
- `list_episodes` → `GET /podcasts/{id}/episodes`
- `get_episode` → `GET /episodes/{id}`
- `get_episode_markers` → `GET /episodes/{id}/markers`
- `list_seasons` → `GET /podcasts/{id}/seasons`
- `get_season_episodes` → `GET /seasons/{id}/episodes`
- `get_analytics_overview` → `GET /analytics`
- `get_downloads_analytics` → `GET /analytics/downloads`
- `get_listener_analytics` → `GET /analytics/listeners`, `/analytics/listeners/last_7`, or `/analytics/podcasts/listeners` (by `report`)
- `get_episodes_analytics` → `GET /analytics/episodes`, `/episodes/average_downloads`, `/episodes/hours_listened`, `/episodes/listeners`, or `/episodes/top_10` (by `report`)
- `get_location_analytics` → `GET /analytics/location`
- `get_time_of_week_analytics` → `GET /analytics/time_of_week`
- `get_technology_analytics` → `GET /analytics/technology/{report}` (or `/analytics/technology` for `summary`)
- `get_embed_analytics` → `GET /analytics/embed/{report}` (or `/analytics/embed` for `summary`)
- `get_campaign_analytics` → `GET /analytics/campaigns/{campaign_id}`
- `list_keywords` → `GET /podcasts/{id}/keywords` or `GET /episodes/{id}/keywords`
- `list_authors` → `GET /podcasts/{id}/authors` or `GET /episodes/{id}/authors`
- `get_oembed` → `GET /oembed`
- `simplecast_get` → escape hatch, any `GET {base}{path}` (host locked to `api.simplecast.com`)
