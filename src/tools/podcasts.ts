import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SimplecastClient } from "../client.js";
import { runTool } from "../types.js";

export function registerPodcastTools(server: McpServer, client: SimplecastClient): void {
  server.registerTool(
    "list_podcasts",
    {
      title: "List podcasts",
      description:
        "List all podcasts (shows) visible to the configured Simplecast account. " +
        "Use this first to discover podcast ids before calling other podcast/episode/analytics tools. " +
        "Returns a paginated collection envelope ({ collection, pages }).",
      inputSchema: {
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
      },
    },
    async ({ limit, offset }) => runTool(() => client.request("/podcasts", { limit, offset }))
  );

  server.registerTool(
    "get_podcast",
    {
      title: "Get podcast",
      description:
        "Fetch full details for a single podcast by id, including its metadata, image, and hypermedia links to episodes/analytics. " +
        "Use list_podcasts first if you don't already know the podcast_id.",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id to fetch."),
      },
    },
    async ({ podcast_id }) => runTool(() => client.request(`/podcasts/${encodeURIComponent(podcast_id)}`))
  );

  server.registerTool(
    "update_podcast",
    {
      title: "Update podcast (MUTATES the live podcast)",
      description:
        "WARNING: this tool MUTATES the live podcast — it performs a partial update (POST) against the real, " +
        "published Simplecast podcast identified by podcast_id, changing whatever fields are given in `attributes`. " +
        "This is not a dry run and there is no undo beyond manually reverting the changed fields. " +
        "Only call this when the user has explicitly asked to change podcast settings/metadata. " +
        "Returns the updated podcast JSON on success.",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id to update."),
        attributes: z
          .record(z.string(), z.unknown())
          .describe(
            "Object of podcast fields to change (only include fields you want to modify), e.g. { \"title\": \"New Title\" }."
          ),
      },
    },
    async ({ podcast_id, attributes }) =>
      runTool(() => client.post(`/podcasts/${encodeURIComponent(podcast_id)}`, attributes))
  );
}
