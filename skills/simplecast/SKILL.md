---
name: simplecast
description: Work with Simplecast podcast hosting and analytics data — episodes, downloads, listeners, geographic and device breakdowns, web player and ad campaign analytics, and account/show management. Use when the user asks about their podcast's performance, episodes, or Simplecast data.
---

# Simplecast

Use this skill when the user wants to look up, analyze, or manage data in their Simplecast account: shows, episodes, downloads, listeners, geography, devices/apps, web player embeds, ad campaigns, distribution channels, or account info.

## Prerequisite

This skill assumes the tools from the **simplecast MCP server** are available (`list_podcasts`, `get_analytics_overview`, `simplecast_get`, etc.). If those tools are not present, tell the user to install the server — see the repo README for setup instructions for Claude Desktop and Claude Code — and stop.

## Core workflow: always resolve IDs first

Every Simplecast id is a UUID. Never guess or fabricate one, and never reuse an id from a different podcast/episode than the one the user means.

1. To act on a show: call `list_podcasts` first, match by title, and use its `id` as `podcast_id`.
2. To act on an episode: call `list_episodes` with the resolved `podcast_id` first, match by title, and use its `id` as `episode_id`.
3. To act on a season: call `list_seasons` with the resolved `podcast_id` first, match, and use its `id` as `season_id`.
4. Only call `get_podcast` / `get_episode` once you have the real id.

If the user gives you an id directly (e.g. pasted from a Simplecast URL), you may use it without a list call, but still sanity-check the resulting `get_podcast`/`get_episode` response matches what they expect.

## Analytics workflow

1. **Start with `get_analytics_overview`** (`podcast_id` or `episode_id`, not both). This is a hypermedia hub — it returns `href` links to every report actually available for that resource on the account's plan.
2. Use the dedicated analytics tools for the common reports: `get_downloads_analytics`, `get_listener_analytics`, `get_episodes_analytics`, `get_location_analytics`, `get_time_of_week_analytics`, `get_technology_analytics`, `get_embed_analytics`, `get_campaign_analytics`.
3. For any report link from step 1 that has no dedicated tool, call `simplecast_get` with the `href`'s path (strip the host — only `api.simplecast.com` paths are accepted) and its query params.

### Exactly-one-of rule

Every scoped analytics tool (`get_analytics_overview`, `get_downloads_analytics`, `get_listener_analytics`, `get_location_analytics`, `get_technology_analytics`, `get_embed_analytics`) takes **either** `podcast_id` **or** `episode_id` — never both, and never neither. Pick the scope the user actually asked about and pass only that id. Same rule for `list_keywords` and `list_authors`.

A few tools are scope-fixed, not either/or:
- `get_time_of_week_analytics` and `get_episodes_analytics` always take `podcast_id` (podcast-only).
- Within `get_embed_analytics`, `report: "avg_completion"` and `report: "heatmap"` require `episode_id` (episode-only); `report: "episodes"`, `"listens"`, `"locations"`, and `"speeds"` all require `podcast_id` (podcast-only). Only the default `report: "summary"` accepts either scope.
- Within `get_listener_analytics`, `report: "last_7"` and `report: "podcast_total"` require `podcast_id` (podcast-only); the default `report: "listeners"` accepts either scope.

## Pagination

List endpoints return an envelope: `{ "collection": [...], "pages": {...} }`. Tools that list things accept `limit` and `offset`. Defaults are small — when auditing a full back catalog (e.g. "how many episodes total," "find every episode from 2023"), keep calling with an increasing `offset` until `collection` comes back short of `limit` or empty, rather than assuming one page is everything.

## Common tasks

**Show performance review**
1. `list_podcasts` → resolve `podcast_id`.
2. `get_analytics_overview` with that `podcast_id` to see what's available.
3. `get_downloads_analytics` and `get_listener_analytics` for the trend.
4. Summarize with numbers, not just a link dump.

**Compare recent episodes / find top performers**
1. Resolve `podcast_id`.
2. `get_episodes_analytics` with `podcast_id` — use `report: "top_10"` for a quick leaderboard, or the default `report: "list"` (page with `limit`/`offset`) for the full rollup. `report: "average_downloads"` and `report: "hours_listened"` give show-wide single numbers instead of a per-episode breakdown.
3. Rank/compare by the metrics returned.

**Geographic breakdown**
1. Resolve `podcast_id` or `episode_id` depending on scope.
2. `get_location_analytics` with that id (and `start_date`/`end_date` if the user gave a window).

**App / device breakdown**
1. Resolve the id.
2. `get_technology_analytics` once per angle needed, e.g. `report: "applications"`, `"browsers"`, `"devices"`, `"device_class"`, `"operating_systems"`, `"listening_methods"`, `"network_types"`, `"providers"`. Use `report: "summary"` first if unsure which angle the user wants. `report: "web_players"` only works with `podcast_id`.

**Web player (embed) performance**
1. Resolve the id.
2. `get_embed_analytics` with `report: "summary"` to see what's available, then drill in: `"episodes"` (podcast, per-episode rollup), `"listens"` or `"locations"` (podcast-only), `"speeds"` (podcast, playback-speed distribution), `"avg_completion"` or `"heatmap"` (episode only — how far into the episode listeners get).

**Ad campaign performance**
1. Get the `campaign_id` from the user or from a prior analytics/link response — campaigns aren't listable through a dedicated tool.
2. `get_campaign_analytics` with that `campaign_id` (and `start_date`/`end_date` if given).

**Listener totals**
1. Resolve the id.
2. `get_listener_analytics` — default `report: "listeners"` for a time series (either scope), `report: "last_7"` for the last-7-days podcast number, or `report: "podcast_total"` for the all-time podcast total.

**Look up keywords / authors / seasons**
1. Resolve `podcast_id` or `episode_id`.
2. `list_keywords` or `list_authors` scoped to exactly one of them.
3. For a season's episodes: resolve `season_id` via `list_seasons`, then `get_season_episodes`.

**Account audit**
1. `get_current_user` for account identity.
2. `list_podcasts` for all shows.
3. `list_distribution_channels` (optionally scoped with `podcast_id`) to see where the show is published.

## Cautions

- `update_podcast` **mutates a live, published show**. Always show the user exactly which fields you're about to change and get explicit confirmation before calling it. Never call it speculatively. Its request shape comes from Simplecast's docs-site examples rather than the official Postman collection — treat it with extra care.
- Some endpoints vary by Simplecast plan and may 404 even with a valid id. Treat a 404 there as "not available on this plan/account," not as a bug. Fall back to `get_analytics_overview` to see what's actually exposed.
- Date params (`start_date`, `end_date`) use `YYYY-MM-DD`.
- Analytics scope errors (wrong or missing `podcast_id`/`episode_id` for a given tool/report) come back as clear tool errors — read the message and retry with the right scope.

## Deeper reference

For exact endpoint paths, the full query-parameter reference from Simplecast's official Postman collection, and error meanings, read `references/api-notes.md` when you need that level of detail.
