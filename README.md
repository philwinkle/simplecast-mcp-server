# Simplecast MCP Server

An MCP (Model Context Protocol) server that exposes the [Simplecast Public API](https://apidocs.simplecast.com/) — podcast hosting, episode management, analytics, and ad performance data — as tools for Claude Desktop and Claude Code.

## What it is

Simplecast is a podcast hosting and analytics platform. This server wraps the Simplecast Public API in a set of MCP tools so Claude can look up your shows and episodes, pull downloads/listener/geographic/device analytics, audit your account, and (optionally, with confirmation) update podcast metadata — all from a chat.

It ships alongside a public [Agent Skill](#install-the-skill) that teaches Claude how to use these tools well: resolving IDs before calling analytics endpoints, discovering which reports are available on your plan, and running common workflows like a show performance review or an episode comparison.

## Getting a token

1. Log in to your [Simplecast dashboard](https://app.simplecast.com/).
2. Go to your account settings → **Private Apps**.
3. Create a new token (private app).
4. Copy the token — you'll set it as the `SIMPLECAST_API_TOKEN` environment variable below.

The server starts even without a token so its tools can be listed, but every tool call will fail with a clear message until `SIMPLECAST_API_TOKEN` is set.

## Install in Claude Desktop

There are two ways to install the server in Claude Desktop.

### Option A: one-click Desktop Extension (recommended)

This server ships as a [Desktop Extension](https://www.anthropic.com/engineering/desktop-extensions) (`.mcpb`) — a single bundle Claude Desktop can install without editing any config files.

1. Build the bundle (or download `dist/simplecast-mcp-server.mcpb` from a release):
   ```bash
   npm install
   npm run package:mcpb
   ```
2. Open Claude Desktop → **Settings → Extensions**, and drag in (or click to open) `dist/simplecast-mcp-server.mcpb`.
3. When prompted, enter your Simplecast API token — see [Getting a token](#getting-a-token) above. Claude Desktop stores it securely and passes it to the server as `SIMPLECAST_API_TOKEN`.

### Option B: manual `claude_desktop_config.json`

Add an entry to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "simplecast": {
      "command": "npx",
      "args": ["-y", "simplecast-mcp-server"],
      "env": {
        "SIMPLECAST_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

Config file locations:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop after saving.

## Install & configure for Claude Code

```bash
claude mcp add simplecast -e SIMPLECAST_API_TOKEN=your-token-here -- npx -y simplecast-mcp-server
```

Or add it to a project's `.mcp.json`:

```json
{
  "mcpServers": {
    "simplecast": {
      "command": "npx",
      "args": ["-y", "simplecast-mcp-server"],
      "env": {
        "SIMPLECAST_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Running from source

```bash
git clone https://github.com/philwinkle/simplecast-mcp-server.git
cd simplecast-mcp-server
npm install
npm run build
```

Then point your MCP config at the built entry point instead of `npx`:

```json
{
  "mcpServers": {
    "simplecast": {
      "command": "node",
      "args": ["/absolute/path/to/simplecast-mcp-server/build/index.js"],
      "env": {
        "SIMPLECAST_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Tools

25 tools total. All return JSON from the Simplecast API. Params marked `?` are optional. Unless noted otherwise, analytics tools take **either** `podcast_id` **or** `episode_id`, never both and never neither.

### Account & reference

| Tool | Description | Key params |
|---|---|---|
| `get_current_user` | Get the authenticated user's account info | — |
| `list_categories` | List Simplecast podcast categories | `limit?`, `offset?` |
| `list_timezones` | List supported timezones | — |
| `list_distribution_channels` | List distribution channels (e.g. Apple Podcasts, Spotify) | `podcast_id?`, `limit?`, `offset?` |
| `list_keywords` | List keywords on a podcast or an episode | exactly one of `podcast_id` / `episode_id` |
| `list_authors` | List authors on a podcast or an episode | exactly one of `podcast_id` / `episode_id` |
| `get_oembed` | Get oEmbed metadata for an episode's public URL | `url` (required) |

### Podcasts

| Tool | Description | Key params |
|---|---|---|
| `list_podcasts` | List podcasts on the account | `limit?`, `offset?`, `search?`, `status?` (enum: `draft`, `published`), `type?` (enum: `serial`, `episodic`, `episodic_seasons`) |
| `get_podcast` | Get a single podcast by id | `podcast_id` (required) |
| `update_podcast` | **Mutating** — updates a live podcast's metadata | `podcast_id` (required), `attributes` (required object of fields to change) |

### Episodes & seasons

| Tool | Description | Key params |
|---|---|---|
| `list_episodes` | List episodes for a podcast | `podcast_id` (required), `limit?`, `offset?`, `search?`, `sort?`, `status?`, `type?` |
| `get_episode` | Get a single episode by id | `episode_id` (required) |
| `get_episode_markers` | Get chapter/ad markers for an episode | `episode_id` (required) |
| `list_seasons` | List seasons for a podcast | `podcast_id` (required) |
| `get_season_episodes` | List episodes in a season | `season_id` (required), `limit?`, `offset?` |

### Analytics

| Tool | Description | Key params |
|---|---|---|
| `get_analytics_overview` | Hypermedia hub — start here; returns links to every analytics report available for your plan | `podcast_id?`, `episode_id?` |
| `get_downloads_analytics` | Download counts over time | `podcast_id?`, `episode_id?`, `start_date?`, `end_date?`, `interval?` (enum: `day`, `week`, `month`), `sort?` (enum: `asc`, `desc`) |
| `get_listener_analytics` | Listener counts | `report?` (enum: `listeners` default, `last_7` podcast-only, `podcast_total` podcast-only), `podcast_id?`, `episode_id?`, `start_date?`, `end_date?`, `interval?`, `sort?` |
| `get_episodes_analytics` | Per-episode analytics rollup for a show | `podcast_id` (required), `report?` (enum: `list` default, `average_downloads`, `hours_listened`, `listeners`, `top_10`), `episodes?` (comma-separated episode ids), `start_date?`, `end_date?`, `interval?`, `sort?`, `limit?`, `offset?` |
| `get_location_analytics` | Geographic breakdown of listens | `podcast_id?`, `episode_id?`, `country?` (int), `state?` (int), `start_date?`, `end_date?`, `sort?` |
| `get_time_of_week_analytics` | Listens broken down by day/time of week | `podcast_id` (required — podcast-only) |
| `get_technology_analytics` | Listens broken down by app, browser, device, OS, network, etc. | `report?` (enum: `summary` default, `applications`, `browsers`, `device_class`, `devices`, `listening_methods`, `network_types`, `operating_systems`, `providers`, `web_players`), `podcast_id?`, `episode_id?`, `start_date?`, `end_date?` — `web_players` is podcast-only |
| `get_embed_analytics` | Web Player (embedded player) analytics | `report?` (enum: `summary` default, `episodes`, `listens`, `locations`, `speeds`, `avg_completion`, `heatmap`), `podcast_id?`, `episode_id?`, `episodes?` (comma-separated episode ids, for `report: "episodes"`), `start_date?`, `end_date?`, `interval?`, `sort?`, `limit?`, `offset?` — `episodes`, `listens`, `locations`, and `speeds` are podcast-only; `avg_completion` and `heatmap` are episode-only |
| `get_campaign_analytics` | Ad campaign performance analytics | `campaign_id` (required), `start_date?`, `end_date?`, `interval?` |

### Escape hatch

| Tool | Description | Key params |
|---|---|---|
| `simplecast_get` | Follow any `href` returned by the API, including reports without a dedicated tool | `path` (required, must start with `/`), `query?` |

Note: `POST /episodes/{id}/audio` (uploading episode audio) exists in the Simplecast API and appears in Simplecast's Postman collection, but is **intentionally not exposed** as a tool here — use the Simplecast dashboard for audio uploads.

## Install the Skill

`skills/simplecast/` is a public [Agent Skill](https://docs.claude.com/en/docs/claude-code/skills) that teaches Claude how to use this server effectively: resolving podcast/episode IDs before calling analytics tools, starting analytics work with `get_analytics_overview` to discover what's available on your plan, and recipes for common tasks (performance reviews, episode comparisons, web player/ad analytics, account audits).

### Claude Desktop / claude.ai

1. Package the skill into a zip:
   ```bash
   npm install
   npm run package:skill
   ```
2. In Claude Desktop or claude.ai, go to **Settings → Capabilities → Skills** and upload `dist/simplecast-skill.zip`.

### Claude Code

Copy the skill folder into a skills directory Claude Code reads from:

- **Personal (all projects)**: copy `skills/simplecast` to `~/.claude/skills/simplecast`.
- **Project (this repo only)**: copy `skills/simplecast` to `.claude/skills/simplecast` in your project.

## Notes

- The Simplecast API is **self-describing / hypermedia**: `get_analytics_overview` returns `href` links to every report actually available for your account and plan, rather than a fixed list. `simplecast_get` can follow any of those hrefs directly.
- `update_podcast` is confirmed against Simplecast's docs-site examples, not against the official Postman collection — the collection does not include a podcast-update request. Always confirm the exact fields being changed with the user before calling it.
- Some endpoints vary by Simplecast plan and account. If one 404s for you, that's most likely a plan/account limitation rather than a bug; fall back to `get_analytics_overview` to see what's actually exposed to you.
- Dates for analytics params use `YYYY-MM-DD`.
- See `skills/simplecast/references/api-notes.md` for the full endpoint reference, including query parameters not yet exposed as typed tool arguments (reachable via `simplecast_get`).

## License

MIT — see [LICENSE](./LICENSE).
