# Simplecast MCP Server

An MCP (Model Context Protocol) server that exposes the [Simplecast Public API](https://apidocs.simplecast.com/) — podcast hosting, episode management, analytics, and ad performance data — as tools for Claude Desktop and Claude Code.

## What it is

Simplecast is a podcast hosting and analytics platform. This server wraps the Simplecast Public API in a set of MCP tools so Claude can look up your shows and episodes, pull downloads/listener/geographic/device analytics, audit your account, and (optionally, with confirmation) update podcast metadata — all from a chat.

It ships alongside a public [Agent Skill](#the-skill) that teaches Claude how to use these tools well: resolving IDs before calling analytics endpoints, discovering which reports are available on your plan, and running common workflows like a show performance review or an episode comparison.

## Getting a token

1. Log in to your [Simplecast dashboard](https://app.simplecast.com/).
2. Go to your account settings → **Private Apps**.
3. Create a new token (private app).
4. Copy the token — you'll set it as the `SIMPLECAST_API_TOKEN` environment variable below.

The server starts even without a token so its tools can be listed, but every tool call will fail with a clear message until `SIMPLECAST_API_TOKEN` is set.

## Install & configure for Claude Desktop

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

All tools return JSON from the Simplecast API. Params marked `?` are optional. Analytics tools take **either** `podcast_id` **or** `episode_id`, never both.

### Account & reference

| Tool | Description | Key params |
|---|---|---|
| `get_current_user` | Get the authenticated user's account info | — |
| `list_categories` | List Simplecast podcast categories | `limit?`, `offset?` |
| `list_timezones` | List supported timezones | — |
| `list_distribution_channels` | List distribution channels (e.g. Apple Podcasts, Spotify) | `podcast_id?`, `limit?`, `offset?` |

### Podcasts

| Tool | Description | Key params |
|---|---|---|
| `list_podcasts` | List podcasts on the account | `limit?`, `offset?` |
| `get_podcast` | Get a single podcast by id | `podcast_id` (required) |
| `update_podcast` | **Mutating** — updates a live podcast's metadata | `podcast_id` (required), `attributes` (required object of fields to change) |

### Episodes

| Tool | Description | Key params |
|---|---|---|
| `list_episodes` | List episodes for a podcast | `podcast_id` (required), `limit?`, `offset?` |
| `get_episode` | Get a single episode by id | `episode_id` (required) |
| `get_episode_markers` | Get chapter/ad markers for an episode | `episode_id` (required) |
| `list_seasons` | List seasons for a podcast | `podcast_id` (required) |

### Analytics

| Tool | Description | Key params |
|---|---|---|
| `get_analytics_overview` | Hypermedia hub — start here; returns links to every analytics report available for your plan | `podcast_id?`, `episode_id?` |
| `get_downloads_analytics` | Download counts over time | `podcast_id?`, `episode_id?`, `start_date?`, `end_date?` |
| `get_listener_analytics` | Listener counts (podcast-level) | `podcast_id?`, `episode_id?`, `start_date?`, `end_date?` |
| `get_episodes_analytics` | Per-episode analytics rollup for a show | `podcast_id` (required), `limit?`, `offset?` |
| `get_location_analytics` | Geographic breakdown of listens | `podcast_id?`, `episode_id?`, `start_date?`, `end_date?` |
| `get_time_of_week_analytics` | Listens broken down by day/time of week | `podcast_id?`, `episode_id?` |
| `get_technology_analytics` | Listens broken down by app, listening method, or device class | `report` (required enum: `applications`, `listening_methods`, `device_class`), `podcast_id?`, `episode_id?` |

### Escape hatch

| Tool | Description | Key params |
|---|---|---|
| `simplecast_get` | Follow any `href` returned by the API, including reports without a dedicated tool | `path` (required, must start with `/`), `query?` |

## The Skill

`skills/simplecast/` is a public [Agent Skill](https://docs.claude.com/en/docs/claude-code/skills) that teaches Claude how to use this server effectively: resolving podcast/episode IDs before calling analytics tools, starting analytics work with `get_analytics_overview` to discover what's available on your plan, and recipes for common tasks (performance reviews, episode comparisons, geographic/device breakdowns, account audits).

To install it:

- **Personal (Claude Code, all projects)**: copy `skills/simplecast` to `~/.claude/skills/simplecast`.
- **Project (Claude Code, this repo only)**: copy `skills/simplecast` to `.claude/skills/simplecast` in your project.
- **claude.ai / Claude Desktop**: where Skills are supported, upload or reference the `skills/simplecast` folder the same way.

## Notes

- The Simplecast API is **self-describing / hypermedia**: `get_analytics_overview` returns `href` links to every report actually available for your account and plan, rather than a fixed list. `simplecast_get` can follow any of those hrefs directly.
- Some endpoints — `get_episode_markers`, `list_seasons`, `get_current_user`, `get_location_analytics`, `get_time_of_week_analytics`, and `get_technology_analytics` — are less consistently documented across Simplecast plans and accounts. If one 404s for you, that's most likely a plan/account limitation rather than a bug; fall back to `get_analytics_overview` to see what's actually exposed to you.
- Dates for analytics params use `YYYY-MM-DD`.

## License

MIT — see [LICENSE](./LICENSE).
