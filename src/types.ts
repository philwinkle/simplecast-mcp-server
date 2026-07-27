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
 * Analytics endpoints accept exactly one of podcast_id / episode_id. Validates that and
 * returns the query param object to merge into the request (`{ podcast }` or `{ episode }`).
 * Throws SimplecastApiError (caught by runTool) if zero or both are given.
 */
export function resolveResourceScope(input: ResourceScopeInput): Record<string, string> {
  const { podcast_id, episode_id } = input;
  if (podcast_id && episode_id) {
    throw new SimplecastApiError(
      "Provide exactly one of podcast_id or episode_id, not both."
    );
  }
  if (!podcast_id && !episode_id) {
    throw new SimplecastApiError(
      "Provide exactly one of podcast_id or episode_id."
    );
  }
  return podcast_id ? { podcast: podcast_id } : { episode: episode_id as string };
}
