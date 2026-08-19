import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SimplecastClient } from "../client.js";
import { runTool } from "../types.js";

const episodeStatusParam = z
  .enum([
    "importing",
    "audio_imported",
    "transcoding",
    "transcoding_error",
    "draft",
    "scheduled",
    "published",
    "private",
  ])
  .optional()
  .describe("Filter episodes by status.");

const episodeSortParam = z
  .string()
  .optional()
  .describe(
    "Field to sort by: title, number, custom_url, published_at, created_at, or updated_at. Ascending by " +
      "default; append _asc or _desc (e.g. \"title_desc\"). Defaults to latest-first."
  );

export function registerEpisodeTools(server: McpServer, client: SimplecastClient): void {
  server.registerTool(
    "list_episodes",
    {
      title: "List episodes",
      description:
        "List episodes belonging to a podcast, most recent first by default. Use list_podcasts first to find the " +
        "podcast_id. Supports searching by title, sorting, and filtering by status/type. Returns a paginated " +
        "collection envelope ({ collection, pages }) of episode summaries.",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id whose episodes to list."),
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
        search: z.string().optional().describe("Search for episodes by title."),
        sort: episodeSortParam,
        status: episodeStatusParam,
        type: z.enum(["full", "trailer", "bonus"]).optional().describe("Filter episodes by type."),
      },
    },
    async ({ podcast_id, limit, offset, search, sort, status, type }) =>
      runTool(() =>
        client.request(`/podcasts/${encodeURIComponent(podcast_id)}/episodes`, {
          limit,
          offset,
          search,
          sort,
          status,
          type,
        })
      )
  );

  server.registerTool(
    "get_episode",
    {
      title: "Get episode",
      description:
        "Fetch full details for a single episode by id, including metadata, audio links, and hypermedia links to markers/analytics. " +
        "Use list_episodes first if you don't already know the episode_id.",
      inputSchema: {
        episode_id: z.string().describe("The Simplecast episode id to fetch."),
      },
    },
    async ({ episode_id }) => runTool(() => client.request(`/episodes/${encodeURIComponent(episode_id)}`))
  );

  server.registerTool(
    "get_episode_markers",
    {
      title: "Get episode markers",
      description:
        "Fetch the chapter/ad markers for a single episode (e.g. ad break positions, chapter timestamps). " +
        "This endpoint is unconfirmed for all accounts/plans; a 404 may simply mean it isn't available for this episode.",
      inputSchema: {
        episode_id: z.string().describe("The Simplecast episode id whose markers to fetch."),
      },
    },
    async ({ episode_id }) =>
      runTool(() => client.request(`/episodes/${encodeURIComponent(episode_id)}/markers`))
  );

  server.registerTool(
    "list_seasons",
    {
      title: "List seasons",
      description: "List the seasons defined for a podcast.",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id whose seasons to list."),
      },
    },
    async ({ podcast_id }) =>
      runTool(() => client.request(`/podcasts/${encodeURIComponent(podcast_id)}/seasons`))
  );

  server.registerTool(
    "get_season_episodes",
    {
      title: "Get season episodes",
      description:
        "List all episodes belonging to a single season. Use list_seasons first to find the season_id. Supports " +
        "sorting and filtering by status. Returns a paginated collection envelope ({ collection, pages }).",
      inputSchema: {
        season_id: z.string().describe("The Simplecast season id whose episodes to list."),
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
        sort: episodeSortParam,
        status: episodeStatusParam,
      },
    },
    async ({ season_id, limit, offset, sort, status }) =>
      runTool(() =>
        client.request(`/seasons/${encodeURIComponent(season_id)}/episodes`, { limit, offset, sort, status })
      )
  );
}
