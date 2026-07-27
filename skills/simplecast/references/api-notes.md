# Simplecast API — reference notes

Condensed from the Simplecast Public API (https://apidocs.simplecast.com/). This is the deep-dive doc — read it when you need exact endpoint paths, param shapes, or error meanings rather than the tool-level workflow guidance in `../SKILL.md`.

## Base URL & auth

- Base URL: `https://api.simplecast.com` **[confirmed]**
- Auth header: `authorization: Bearer <token>`, token from env `SIMPLECAST_API_TOKEN`.
- Token source: Simplecast dashboard → account → **Private Apps** page. **[confirmed]**
- If the token is missing, the server still starts (tools list fine) but every call fails with a message pointing back to the Private Apps page.

## Pagination

List endpoints accept `limit` and `offset` query params (e.g. `?limit=12&offset=0`). **[confirmed]**

Response envelope:

```json
{
  "collection": [ /* items */ ],
  "pages": { /* paging metadata, e.g. total/next/prev */ }
}
```

To page through a full collection, increase `offset` by the page size until `collection` is shorter than `limit` or empty.

## Hypermedia design

Simplecast responses are self-describing: they include `href` links to related resources and, for analytics, to every report available for that resource on the caller's plan. **[confirmed — per Simplecast docs language]**

`GET /analytics?podcast={id}` or `?episode={id}` is the hub: its response lists hrefs for whichever reports actually exist for that podcast/episode given the account's plan. Prefer following those hrefs (via the `simplecast_get` tool) over assuming a report exists, especially for the "probable" endpoints below.

## Endpoints

### Confirmed (quoted curl examples / Airbyte connector manifest)

| Method & path | Notes |
|---|---|
| `GET /podcasts` | List podcasts. `limit`/`offset`. |
| `GET /podcasts/{podcast_id}` | Single podcast. |
| `POST /podcasts/{podcast_id}` | **Mutating.** Partial update — JSON body of only the changed fields. Simplecast uses `POST`, not `PATCH`, for this. |
| `GET /podcasts/{podcast_id}/episodes` | List episodes for a show. `limit`/`offset`. |
| `GET /analytics?podcast={id}` / `?episode={id}` | Hypermedia hub — links to available reports. |
| `GET /analytics/downloads?podcast={id}` / `?episode={id}` | Download counts. |
| `GET /analytics/podcasts/listeners?podcast={id}` | Listener counts, podcast-level. |
| `GET /analytics/episodes?podcast={id}` | Per-episode analytics rollup for a show. Paginated. |
| `GET /categories` | Podcast categories. |
| `GET /distribution_channels` | Distribution channels; accepts a `podcast` query param to scope. |
| `GET /timezones` | Supported timezones. |

### Probable (Postman workspace titles — not independently curl-verified; degrade gracefully, treat 404 as "not on this plan/account")

| Method & path | Notes |
|---|---|
| `GET /episodes/{episode_id}` | Single episode. |
| `GET /episodes/{episode_id}/markers` | Chapter/ad markers for an episode. |
| `GET /podcasts/{podcast_id}/seasons` | Seasons for a show. |
| `GET /current_user` | Authenticated account/user info. |
| `GET /analytics/location?podcast=` / `?episode=` | Geographic breakdown. |
| `GET /analytics/time_of_week?podcast=` / `?episode=` | Listens by day/time of week. |
| `GET /analytics/technology/applications` / `/listening_methods` / `/device_class` — with `?podcast=` or `?episode=` | App / listening method / device class breakdown. |

Optional on analytics endpoints: `start_date` / `end_date` (`YYYY-MM-DD`) — support is not guaranteed per-endpoint; pass them when the user gives a window and let the API ignore or reject as appropriate.

## Rate limits

No documented rate limit. Treat `429` defensively: surface `Retry-After` if the response includes it.

## Errors

| Status | Meaning | Handling |
|---|---|---|
| `401` | Invalid or expired token | Point the user back to Simplecast → Account → Private Apps to issue a fresh token. |
| `404` | Resource not found *or* endpoint not available for this plan/account | Don't assume a bug — for "probable" endpoints, treat as a plan limitation and fall back to `get_analytics_overview`. For confirmed endpoints, double-check the id. |
| `429` | Rate limited | Back off; include `Retry-After` (if present) in the message back to the user. |

Error bodies from the API are surfaced truncated (~500 chars) alongside the status-based message.

## Tool-to-endpoint map

See the README's tool table for the authoritative list of tool names and params. Quick map for reference:

- `get_current_user` → `GET /current_user`
- `list_categories` → `GET /categories`
- `list_timezones` → `GET /timezones`
- `list_distribution_channels` → `GET /distribution_channels`
- `list_podcasts` → `GET /podcasts`
- `get_podcast` → `GET /podcasts/{id}`
- `update_podcast` → `POST /podcasts/{id}` (mutating)
- `list_episodes` → `GET /podcasts/{id}/episodes`
- `get_episode` → `GET /episodes/{id}`
- `get_episode_markers` → `GET /episodes/{id}/markers`
- `list_seasons` → `GET /podcasts/{id}/seasons`
- `get_analytics_overview` → `GET /analytics`
- `get_downloads_analytics` → `GET /analytics/downloads`
- `get_listener_analytics` → `GET /analytics/podcasts/listeners`
- `get_episodes_analytics` → `GET /analytics/episodes?podcast=`
- `get_location_analytics` → `GET /analytics/location`
- `get_time_of_week_analytics` → `GET /analytics/time_of_week`
- `get_technology_analytics` → `GET /analytics/technology/{report}`
- `simplecast_get` → escape hatch, any `GET {base}{path}` (host locked to `api.simplecast.com`)
