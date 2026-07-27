import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SimplecastClient } from "../client.js";
import { runTool } from "../types.js";

export function registerAccountTools(server: McpServer, client: SimplecastClient): void {
  server.registerTool(
    "get_current_user",
    {
      title: "Get current user",
      description:
        "Fetch the Simplecast account/user associated with the configured API token. " +
        "Use this to confirm which account you're operating against, or to discover account-level metadata. Returns the raw user JSON.",
      inputSchema: {},
    },
    async () => runTool(() => client.request("/current_user"))
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description:
        "List the podcast categories supported by Simplecast (e.g. for classifying/updating a podcast's category). " +
        "Returns a paginated collection envelope ({ collection, pages }).",
      inputSchema: {
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
      },
    },
    async ({ limit, offset }) =>
      runTool(() => client.request("/categories", { limit, offset }))
  );

  server.registerTool(
    "list_timezones",
    {
      title: "List timezones",
      description:
        "List the timezone identifiers accepted by the Simplecast API (e.g. for podcast/episode scheduling fields). Returns the raw API response.",
      inputSchema: {},
    },
    async () => runTool(() => client.request("/timezones"))
  );

  server.registerTool(
    "list_distribution_channels",
    {
      title: "List distribution channels",
      description:
        "List distribution channels (e.g. Apple Podcasts, Spotify) known to Simplecast, optionally scoped to a single podcast. " +
        "Use this to see where a podcast is distributed or to look up channel ids. Returns a paginated collection envelope.",
      inputSchema: {
        podcast_id: z
          .string()
          .optional()
          .describe("Optional podcast id to scope distribution channels to a single show."),
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
      },
    },
    async ({ podcast_id, limit, offset }) =>
      runTool(() =>
        client.request("/distribution_channels", { podcast: podcast_id, limit, offset })
      )
  );
}
