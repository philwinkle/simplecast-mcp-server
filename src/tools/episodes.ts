import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SimplecastClient } from "../client.js";
import { runTool } from "../types.js";

export function registerEpisodeTools(server: McpServer, client: SimplecastClient): void {
  server.registerTool(
    "list_episodes",
    {
      title: "List episodes",
      description:
        "List episodes belonging to a podcast, most recent first. Use list_podcasts first to find the podcast_id. " +
        "Returns a paginated collection envelope ({ collection, pages }) of episode summaries.",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id whose episodes to list."),
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
      },
    },
    async ({ podcast_id, limit, offset }) =>
      runTool(() =>
        client.request(`/podcasts/${encodeURIComponent(podcast_id)}/episodes`, { limit, offset })
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
      description:
        "List the seasons defined for a podcast. This endpoint is unconfirmed for all accounts/plans; a 404 may simply mean the podcast doesn't use seasons.",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id whose seasons to list."),
      },
    },
    async ({ podcast_id }) =>
      runTool(() => client.request(`/podcasts/${encodeURIComponent(podcast_id)}/seasons`))
  );
}
