import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SimplecastClient } from "../client.js";
import { runTool, resolveResourceScope } from "../types.js";

const podcastIdParam = z
  .string()
  .optional()
  .describe("Podcast id to scope the report to. Provide exactly one of podcast_id or episode_id.");
const episodeIdParam = z
  .string()
  .optional()
  .describe("Episode id to scope the report to. Provide exactly one of podcast_id or episode_id.");
const startDateParam = z
  .string()
  .optional()
  .describe("Start of the date range, as YYYY-MM-DD, if supported by the endpoint.");
const endDateParam = z
  .string()
  .optional()
  .describe("End of the date range, as YYYY-MM-DD, if supported by the endpoint.");

export function registerAnalyticsTools(server: McpServer, client: SimplecastClient): void {
  server.registerTool(
    "get_analytics_overview",
    {
      title: "Get analytics overview",
      description:
        "START HERE for analytics: fetch the Simplecast analytics hypermedia hub for a podcast or episode, which " +
        "returns hrefs of every analytics report actually available for that resource. Use this before calling a " +
        "specific analytics tool if you're unsure which reports exist, or use simplecast_get to follow an href it returns.",
      inputSchema: {
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
      },
    },
    async ({ podcast_id, episode_id }) =>
      runTool(() => {
        const scope = resolveResourceScope({ podcast_id, episode_id });
        return client.request("/analytics", scope);
      })
  );

  server.registerTool(
    "get_downloads_analytics",
    {
      title: "Get downloads analytics",
      description:
        "Fetch download counts over time for a podcast or episode. Use for questions about total/trend downloads. " +
        "Optionally scope to a date range.",
      inputSchema: {
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
        start_date: startDateParam,
        end_date: endDateParam,
      },
    },
    async ({ podcast_id, episode_id, start_date, end_date }) =>
      runTool(() => {
        const scope = resolveResourceScope({ podcast_id, episode_id });
        return client.request("/analytics/downloads", {
          ...scope,
          start_date,
          end_date,
        });
      })
  );

  server.registerTool(
    "get_listener_analytics",
    {
      title: "Get listener analytics",
      description:
        "Fetch listener counts/trends for a podcast (podcast-level listener metrics; pass episode_id to scope to a " +
        "single episode using the same param style, though this report is primarily podcast-level). " +
        "Optionally scope to a date range.",
      inputSchema: {
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
        start_date: startDateParam,
        end_date: endDateParam,
      },
    },
    async ({ podcast_id, episode_id, start_date, end_date }) =>
      runTool(() => {
        const scope = resolveResourceScope({ podcast_id, episode_id });
        return client.request("/analytics/podcasts/listeners", {
          ...scope,
          start_date,
          end_date,
        });
      })
  );

  server.registerTool(
    "get_episodes_analytics",
    {
      title: "Get per-episode analytics rollup",
      description:
        "Fetch a per-episode analytics rollup (e.g. downloads per episode) for an entire show — useful for comparing " +
        "episodes against each other. Requires podcast_id (not episode_id). Returns a paginated collection envelope.",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id whose episodes to roll up analytics for."),
        limit: z.number().int().positive().optional().describe("Max number of results per page."),
        offset: z.number().int().nonnegative().optional().describe("Number of results to skip, for pagination."),
      },
    },
    async ({ podcast_id, limit, offset }) =>
      runTool(() =>
        client.request("/analytics/episodes", { podcast: podcast_id, limit, offset })
      )
  );

  server.registerTool(
    "get_location_analytics",
    {
      title: "Get location analytics",
      description:
        "Fetch a geographic breakdown of listeners/downloads for a podcast or episode (e.g. by country/region). " +
        "Optionally scope to a date range. This endpoint is unconfirmed for all accounts/plans; a 404 may mean it isn't available for this plan.",
      inputSchema: {
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
        start_date: startDateParam,
        end_date: endDateParam,
      },
    },
    async ({ podcast_id, episode_id, start_date, end_date }) =>
      runTool(() => {
        const scope = resolveResourceScope({ podcast_id, episode_id });
        return client.request("/analytics/location", {
          ...scope,
          start_date,
          end_date,
        });
      })
  );

  server.registerTool(
    "get_time_of_week_analytics",
    {
      title: "Get time-of-week analytics",
      description:
        "Fetch a breakdown of listening activity by day/time of week for a podcast or episode — useful for finding the " +
        "best publish times. This endpoint is unconfirmed for all accounts/plans; a 404 may mean it isn't available for this plan.",
      inputSchema: {
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
      },
    },
    async ({ podcast_id, episode_id }) =>
      runTool(() => {
        const scope = resolveResourceScope({ podcast_id, episode_id });
        return client.request("/analytics/time_of_week", scope);
      })
  );

  server.registerTool(
    "get_technology_analytics",
    {
      title: "Get technology analytics",
      description:
        "Fetch a technology breakdown (listening app, listening method, or device class) for a podcast or episode. " +
        "Choose which breakdown via `report`. This endpoint is unconfirmed for all accounts/plans; a 404 may mean it isn't available for this plan.",
      inputSchema: {
        report: z
          .enum(["applications", "listening_methods", "device_class"])
          .describe(
            "Which technology breakdown to fetch: 'applications' (listening apps), 'listening_methods' (e.g. app/web/download), or 'device_class' (e.g. mobile/desktop)."
          ),
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
      },
    },
    async ({ report, podcast_id, episode_id }) =>
      runTool(() => {
        const scope = resolveResourceScope({ podcast_id, episode_id });
        return client.request(`/analytics/technology/${encodeURIComponent(report)}`, scope);
      })
  );
}
