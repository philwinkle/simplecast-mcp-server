import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SimplecastClient } from "../client.js";
import { runTool } from "../types.js";
import { registerAccountTools } from "./account.js";
import { registerPodcastTools } from "./podcasts.js";
import { registerEpisodeTools } from "./episodes.js";
import { registerAnalyticsTools } from "./analytics.js";
import { registerResourceTools } from "./resources.js";

/** Registers every Simplecast MCP tool (account/reference, podcasts, episodes, analytics, resources, escape hatch). */
export function registerAllTools(server: McpServer, client: SimplecastClient): void {
  registerAccountTools(server, client);
  registerPodcastTools(server, client);
  registerEpisodeTools(server, client);
  registerAnalyticsTools(server, client);
  registerResourceTools(server, client);
  registerEscapeHatchTool(server, client);
}

function registerEscapeHatchTool(server: McpServer, client: SimplecastClient): void {
  server.registerTool(
    "simplecast_get",
    {
      title: "Simplecast raw GET (escape hatch)",
      description:
        "Read-only escape hatch: performs a raw GET against the Simplecast API for any path not covered by a " +
        "dedicated tool — most commonly to follow an `href` link returned inside another tool's response " +
        "(the Simplecast API is hypermedia: responses link to related resources and available reports). " +
        "Only api.simplecast.com is reachable: if given a full URL, it is only used when its host is " +
        "api.simplecast.com (and is reduced to its path), otherwise the call is rejected.",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Path to GET, must start with \"/\" (e.g. \"/analytics/downloads\"), or a full https://api.simplecast.com/... URL (an href from another tool's response)."
          ),
        query: z
          .record(z.string(), z.union([z.string(), z.number()]))
          .optional()
          .describe("Optional object of query string parameters to add to the request."),
      },
    },
    async ({ path, query }) => runTool(() => client.getArbitrary(path, query))
  );
}
