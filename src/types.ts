/**
 * Shared helpers used across tool modules: MCP result builders, generic error handling,
 * and the "exactly one of podcast_id / episode_id" validation used by analytics tools.
 */

import { SimplecastApiError } from "./client.js";

export interface McpToolTextResult {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Wrap successful tool data as a pretty-printed JSON text content block. */
export function toResult(data: unknown): McpToolTextResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Wrap an error message as an isError text content block (never throws). */
export function toErrorResult(message: string): McpToolTextResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Runs a tool handler and converts any thrown error (SimplecastApiError or otherwise)
 * into an isError result, so tool calls never throw across the MCP boundary.
 */
export async function runTool(fn: () => Promise<unknown>): Promise<McpToolTextResult> {
  try {
    const data = await fn();
    return toResult(data);
  } catch (error) {
    if (error instanceof SimplecastApiError) {
      return toErrorResult(error.message);
    }
    return toErrorResult(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface ResourceScopeInput {
  podcast_id?: string;
  episode_id?: string;
}

/**
 * Analytics endpoints that accept exactly one of podcast_id / episode_id. Validates that and
 * returns the query param object to merge into the request (`{ podcast }` or `{ episode }`).
 * Throws SimplecastApiError (caught by runTool) if zero or both are given.
 *
 * `context` is optional and only used to make the error message more specific (e.g. naming
 * the tool and report), so existing callers that don't pass it keep working unchanged.
 */
export function resolveResourceScope(
  input: ResourceScopeInput,
  context?: string
): Record<string, string> {
  const { podcast_id, episode_id } = input;
  const suffix = context ? ` for ${context}` : "";
  if (podcast_id && episode_id) {
    throw new SimplecastApiError(
      `Provide exactly one of podcast_id or episode_id${suffix}, not both.`
    );
  }
  if (!podcast_id && !episode_id) {
    throw new SimplecastApiError(`Provide exactly one of podcast_id or episode_id${suffix}.`);
  }
  return podcast_id ? { podcast: podcast_id } : { episode: episode_id as string };
}

/**
 * For reports that are podcast-only (per the Simplecast API docs): rejects episode_id with a
 * clear message naming the report/tool, requires podcast_id, and returns it.
 */
export function requirePodcastId(input: ResourceScopeInput, context: string): string {
  const { podcast_id, episode_id } = input;
  if (episode_id) {
    throw new SimplecastApiError(
      `${context} is podcast-only — it does not accept episode_id (got "${episode_id}"). ` +
        "Provide podcast_id instead."
    );
  }
  if (!podcast_id) {
    throw new SimplecastApiError(`${context} requires podcast_id.`);
  }
  return podcast_id;
}

/**
 * For reports that are episode-only (per the Simplecast API docs): rejects podcast_id with a
 * clear message naming the report/tool, requires episode_id, and returns it.
 */
export function requireEpisodeId(input: ResourceScopeInput, context: string): string {
  const { podcast_id, episode_id } = input;
  if (podcast_id) {
    throw new SimplecastApiError(
      `${context} is episode-only — it does not accept podcast_id (got "${podcast_id}"). ` +
        "Provide episode_id instead."
    );
  }
  if (!episode_id) {
    throw new SimplecastApiError(`${context} requires episode_id.`);
  }
  return episode_id;
}

/**
 * For non-analytics resource lookups that accept exactly one of podcast_id / episode_id and
 * route to a different REST path depending on which was given (e.g. list_keywords,
 * list_authors). Returns which kind was given plus its id, rather than a query param object.
 */
export function resolveEitherId(
  input: ResourceScopeInput,
  context: string
): { kind: "podcast" | "episode"; id: string } {
  const { podcast_id, episode_id } = input;
  if (podcast_id && episode_id) {
    throw new SimplecastApiError(
      `Provide exactly one of podcast_id or episode_id for ${context}, not both.`
    );
  }
  if (!podcast_id && !episode_id) {
    throw new SimplecastApiError(`Provide exactly one of podcast_id or episode_id for ${context}.`);
  }
  return podcast_id ? { kind: "podcast", id: podcast_id } : { kind: "episode", id: episode_id as string };
}
