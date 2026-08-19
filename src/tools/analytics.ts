import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SimplecastClient } from "../client.js";
import {
  runTool,
  resolveResourceScope,
  requirePodcastId,
  requireEpisodeId,
} from "../types.js";

/**
 * Query param names, scope rules (podcast-only / episode-only / either), and which of
 * start_date/end_date/interval/sort/etc. each endpoint accepts were extracted directly from
 * the official Simplecast Postman collection's per-request parameter tables (and, where the
 * table and the endpoint's prose description disagreed — see get_embed_analytics below — the
 * prose was treated as authoritative). `email` (send-as-CSV-to-your-inbox) is documented on
 * almost every analytics endpoint but is deliberately not exposed: it doesn't return data to
 * the caller, so it isn't useful as an MCP tool parameter.
 */

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
  .describe(
    "Start of the date range (ISO 8601 date, e.g. YYYY-MM-DD). Defaults to the resource's published_at date."
  );
const endDateParam = z
  .string()
  .optional()
  .describe("End of the date range (ISO 8601 date, e.g. YYYY-MM-DD). Defaults to now.");
const intervalParam = z
  .enum(["day", "week", "month"])
  .optional()
  .describe("Bucket size for the time series. One of day, week, month. Defaults to day.");
const sortParam = z
  .enum(["asc", "desc"])
  .optional()
  .describe("Sort order by date of interval. Defaults to asc.");
const limitParam = z.number().int().positive().optional().describe("Max number of results per page.");
const offsetParam = z
  .number()
  .int()
  .nonnegative()
  .optional()
  .describe("Number of results to skip, for pagination.");

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
        const scope = resolveResourceScope({ podcast_id, episode_id }, "get_analytics_overview");
        return client.request("/analytics", scope);
      })
  );

  server.registerTool(
    "get_downloads_analytics",
    {
      title: "Get downloads analytics",
      description:
        "Fetch download counts over time for a podcast or episode, as a time series. Optionally scope to a date " +
        "range and bucket size (interval).",
      inputSchema: {
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
        start_date: startDateParam,
        end_date: endDateParam,
        interval: intervalParam,
        sort: sortParam,
      },
    },
    async ({ podcast_id, episode_id, start_date, end_date, interval, sort }) =>
      runTool(() => {
        const scope = resolveResourceScope({ podcast_id, episode_id }, "get_downloads_analytics");
        return client.request("/analytics/downloads", { ...scope, start_date, end_date, interval, sort });
      })
  );

  server.registerTool(
    "get_listener_analytics",
    {
      title: "Get listener analytics",
      description:
        "Fetch unique-listener metrics for a podcast or episode. `report` selects which listener report: " +
        "'listeners' (default; time series for a podcast or episode), 'last_7' (unique listeners for a podcast " +
        "over the last 7 days, podcast-only), or 'podcast_total' (total unique listener count for a podcast, " +
        "podcast-only).",
      inputSchema: {
        report: z
          .enum(["listeners", "last_7", "podcast_total"])
          .optional()
          .describe(
            "Which listener report to fetch: 'listeners' (default, podcast or episode time series), " +
              "'last_7' (podcast-only, last 7 days), or 'podcast_total' (podcast-only, all-time total)."
          ),
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
        start_date: startDateParam,
        end_date: endDateParam,
        interval: intervalParam,
        sort: sortParam,
      },
    },
    async ({ report, podcast_id, episode_id, start_date, end_date, interval, sort }) =>
      runTool(() => {
        const r = report ?? "listeners";
        if (r === "last_7") {
          const pid = requirePodcastId({ podcast_id, episode_id }, "get_listener_analytics report=last_7");
          return client.request("/analytics/listeners/last_7", { podcast: pid });
        }
        if (r === "podcast_total") {
          const pid = requirePodcastId({ podcast_id, episode_id }, "get_listener_analytics report=podcast_total");
          return client.request("/analytics/podcasts/listeners", { podcast: pid, start_date, end_date });
        }
        const scope = resolveResourceScope({ podcast_id, episode_id }, "get_listener_analytics report=listeners");
        return client.request("/analytics/listeners", { ...scope, start_date, end_date, interval, sort });
      })
  );

  server.registerTool(
    "get_episodes_analytics",
    {
      title: "Get per-episode analytics rollups",
      description:
        "Fetch analytics for an entire show grouped/rolled up by episode. Requires podcast_id. `report` selects " +
        "which rollup: 'list' (default; paginated per-episode download stats), 'average_downloads', " +
        "'hours_listened', 'listeners' (unique listeners per episode), or 'top_10' (the podcast's top 10 episodes).",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id whose episodes to roll up analytics for."),
        report: z
          .enum(["list", "average_downloads", "hours_listened", "listeners", "top_10"])
          .optional()
          .describe(
            "Which rollup to fetch: 'list' (default, paginated), 'average_downloads', 'hours_listened', " +
              "'listeners', or 'top_10'."
          ),
        episodes: z
          .string()
          .optional()
          .describe(
            "Optional comma-separated episode ids to restrict the rollup to (applies to 'list'/'listeners' reports)."
          ),
        start_date: startDateParam,
        end_date: endDateParam,
        interval: intervalParam,
        sort: sortParam,
        limit: limitParam,
        offset: offsetParam,
      },
    },
    async ({ podcast_id, report, episodes, start_date, end_date, interval, sort, limit, offset }) =>
      runTool(() => {
        const r = report ?? "list";
        switch (r) {
          case "average_downloads":
            return client.request("/analytics/episodes/average_downloads", { podcast: podcast_id });
          case "hours_listened":
            return client.request("/analytics/episodes/hours_listened", { podcast: podcast_id });
          case "listeners":
            return client.request("/analytics/episodes/listeners", {
              podcast: podcast_id,
              episodes,
              start_date,
              end_date,
              interval,
              sort,
            });
          case "top_10":
            return client.request("/analytics/episodes/top_10", { podcast: podcast_id, start_date, end_date });
          case "list":
          default:
            return client.request("/analytics/episodes", {
              podcast: podcast_id,
              episodes,
              start_date,
              end_date,
              interval,
              sort,
              limit,
              offset,
            });
        }
      })
  );

  server.registerTool(
    "get_location_analytics",
    {
      title: "Get location analytics",
      description:
        "Fetch a geographic breakdown of listeners/downloads for a podcast or episode. Optionally filter to a " +
        "single country/state (by Simplecast location id) and scope to a date range.",
      inputSchema: {
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
        country: z.number().int().optional().describe("Simplecast country id to filter analytics to a single country."),
        state: z.number().int().optional().describe("Simplecast state id to filter analytics to a single state/region."),
        start_date: startDateParam,
        end_date: endDateParam,
        sort: sortParam,
      },
    },
    async ({ podcast_id, episode_id, country, state, start_date, end_date, sort }) =>
      runTool(() => {
        const scope = resolveResourceScope({ podcast_id, episode_id }, "get_location_analytics");
        return client.request("/analytics/location", { ...scope, country, state, start_date, end_date, sort });
      })
  );

  server.registerTool(
    "get_time_of_week_analytics",
    {
      title: "Get time-of-week analytics",
      description:
        "Fetch a breakdown of listening activity by day/time of week for a podcast — useful for finding the best " +
        "publish times. Podcast-only (the Simplecast API does not offer this report at the episode level).",
      inputSchema: {
        podcast_id: z.string().describe("The Simplecast podcast id to fetch the time-of-week breakdown for."),
        start_date: startDateParam,
        end_date: endDateParam,
      },
    },
    async ({ podcast_id, start_date, end_date }) =>
      runTool(() => client.request("/analytics/time_of_week", { podcast: podcast_id, start_date, end_date }))
  );

  server.registerTool(
    "get_technology_analytics",
    {
      title: "Get technology analytics",
      description:
        "Fetch a listener-technology breakdown for a podcast or episode. `report` selects which breakdown: " +
        "'summary' (default; hub of available technology reports), 'applications' (listening apps), 'browsers', " +
        "'device_class' (e.g. mobile/desktop), 'devices', 'listening_methods' (e.g. app/web/download), " +
        "'network_types', 'operating_systems', 'providers', or 'web_players' (podcast-only).",
      inputSchema: {
        report: z
          .enum([
            "summary",
            "applications",
            "browsers",
            "device_class",
            "devices",
            "listening_methods",
            "network_types",
            "operating_systems",
            "providers",
            "web_players",
          ])
          .optional()
          .describe("Which technology breakdown to fetch. Defaults to 'summary'. 'web_players' is podcast-only."),
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
        start_date: startDateParam,
        end_date: endDateParam,
      },
    },
    async ({ report, podcast_id, episode_id, start_date, end_date }) =>
      runTool(() => {
        const r = report ?? "summary";
        if (r === "web_players") {
          const pid = requirePodcastId({ podcast_id, episode_id }, "get_technology_analytics report=web_players");
          return client.request("/analytics/technology/web_players", { podcast: pid });
        }
        const scope = resolveResourceScope({ podcast_id, episode_id }, `get_technology_analytics report=${r}`);
        if (r === "summary") {
          return client.request("/analytics/technology", scope);
        }
        return client.request(`/analytics/technology/${encodeURIComponent(r)}`, {
          ...scope,
          start_date,
          end_date,
        });
      })
  );

  server.registerTool(
    "get_embed_analytics",
    {
      title: "Get Web Player (embed) analytics",
      description:
        "Fetch analytics for Simplecast's embedded Web Player. `report` selects which breakdown: 'summary' " +
        "(default; hub of available Web Player reports, podcast or episode), 'episodes' (per-episode Web Player " +
        "stats, podcast-only), 'listens' (podcast-only), 'locations' (podcast-only), 'speeds' (listening speed " +
        "distribution, podcast-only), 'avg_completion' (average % of episode listened, episode-only), or " +
        "'heatmap' (second-by-second listen-through data, episode-only).",
      inputSchema: {
        report: z
          .enum(["summary", "episodes", "listens", "locations", "speeds", "avg_completion", "heatmap"])
          .optional()
          .describe(
            "Which Web Player report to fetch. Defaults to 'summary'. 'episodes'/'listens'/'locations'/'speeds' " +
              "are podcast-only; 'avg_completion'/'heatmap' are episode-only."
          ),
        podcast_id: podcastIdParam,
        episode_id: episodeIdParam,
        episodes: z
          .string()
          .optional()
          .describe("Optional comma-separated episode ids to restrict the 'episodes' report to."),
        start_date: startDateParam,
        end_date: endDateParam,
        interval: intervalParam,
        sort: sortParam,
        limit: limitParam,
        offset: offsetParam,
      },
    },
    async ({ report, podcast_id, episode_id, episodes, start_date, end_date, interval, sort, limit, offset }) =>
      runTool(() => {
        const r = report ?? "summary";
        switch (r) {
          case "episodes": {
            const pid = requirePodcastId({ podcast_id, episode_id }, "get_embed_analytics report=episodes");
            return client.request("/analytics/embed/episodes", {
              podcast: pid,
              episodes,
              start_date,
              end_date,
              interval,
              sort,
              limit,
              offset,
            });
          }
          case "listens": {
            const pid = requirePodcastId({ podcast_id, episode_id }, "get_embed_analytics report=listens");
            return client.request("/analytics/embed/listens", { podcast: pid, start_date, end_date, interval, sort });
          }
          case "locations": {
            const pid = requirePodcastId({ podcast_id, episode_id }, "get_embed_analytics report=locations");
            return client.request("/analytics/embed/locations", {
              podcast: pid,
              start_date,
              end_date,
              sort,
              limit,
              offset,
            });
          }
          case "speeds": {
            const pid = requirePodcastId({ podcast_id, episode_id }, "get_embed_analytics report=speeds");
            return client.request("/analytics/embed/speeds", { podcast: pid, start_date, end_date });
          }
          case "avg_completion": {
            const eid = requireEpisodeId({ podcast_id, episode_id }, "get_embed_analytics report=avg_completion");
            return client.request("/analytics/embed/avg_completion", { episode: eid, start_date, end_date, sort });
          }
          case "heatmap": {
            const eid = requireEpisodeId({ podcast_id, episode_id }, "get_embed_analytics report=heatmap");
            return client.request("/analytics/embed/heatmap", { episode: eid, start_date, end_date });
          }
          case "summary":
          default: {
            const scope = resolveResourceScope({ podcast_id, episode_id }, "get_embed_analytics report=summary");
            return client.request("/analytics/embed", scope);
          }
        }
      })
  );

  server.registerTool(
    "get_campaign_analytics",
    {
      title: "Get ad campaign analytics",
      description:
        "Fetch analytics for a single Simplecast ad campaign by id (impressions/performance over time). " +
        "Optionally scope to a date range and bucket size (interval).",
      inputSchema: {
        campaign_id: z.string().describe("The Simplecast campaign id to fetch analytics for."),
        start_date: startDateParam,
        end_date: endDateParam,
        interval: intervalParam,
      },
    },
    async ({ campaign_id, start_date, end_date, interval }) =>
      runTool(() =>
        client.request(`/analytics/campaigns/${encodeURIComponent(campaign_id)}`, {
          start_date,
          end_date,
          interval,
        })
      )
  );
}
