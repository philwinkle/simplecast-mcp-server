import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SimplecastClient } from "../client.js";
import { runTool, resolveEitherId } from "../types.js";

const eitherIdSchema = {
  podcast_id: z
    .string()
    .optional()
    .describe("Podcast id to list for. Provide exactly one of podcast_id or episode_id."),
  episode_id: z
    .string()
    .optional()
    .describe("Episode id to list for. Provide exactly one of podcast_id or episode_id."),
};

/** Registers cross-resource lookup tools: keywords, authors, and oEmbed. */
export function registerResourceTools(server: McpServer, client: SimplecastClient): void {
  server.registerTool(
    "list_keywords",
    {
      title: "List keywords",
      description:
        "List the keywords/tags attached to a podcast or a single episode. Provide exactly one of podcast_id or " +
        "episode_id. Returns a paginated collection envelope.",
      inputSchema: {
        ...eitherIdSchema,
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
      },
    },
    async ({ podcast_id, episode_id, limit, offset }) =>
      runTool(() => {
        const { kind, id } = resolveEitherId({ podcast_id, episode_id }, "list_keywords");
        const path =
          kind === "podcast"
            ? `/podcasts/${encodeURIComponent(id)}/keywords`
            : `/episodes/${encodeURIComponent(id)}/keywords`;
        return client.request(path, { limit, offset });
      })
  );

  server.registerTool(
    "list_authors",
    {
      title: "List authors",
      description:
        "List the authors attached to a podcast or a single episode. Provide exactly one of podcast_id or " +
        "episode_id. Returns a paginated collection envelope.",
      inputSchema: {
        ...eitherIdSchema,
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
      },
    },
    async ({ podcast_id, episode_id, limit, offset }) =>
      runTool(() => {
        const { kind, id } = resolveEitherId({ podcast_id, episode_id }, "list_authors");
        const path =
          kind === "podcast"
            ? `/podcasts/${encodeURIComponent(id)}/authors`
            : `/episodes/${encodeURIComponent(id)}/authors`;
        return client.request(path, { limit, offset });
      })
  );

  server.registerTool(
    "get_oembed",
    {
      title: "Get oEmbed info",
      description:
        "Load oEmbed information (e.g. embeddable player HTML, title, thumbnail) for a public Simplecast episode " +
        "page URL, per the oEmbed spec.",
      inputSchema: {
        url: z.string().describe("The public Simplecast episode page URL to load oEmbed data for."),
      },
    },
    async ({ url }) => runTool(() => client.request("/oembed", { url }))
  );
}
