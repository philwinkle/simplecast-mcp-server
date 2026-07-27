/**
 * SimplecastClient: thin fetch wrapper around the Simplecast Public API.
 *
 * - Base URL: https://api.simplecast.com
 * - Auth: `Authorization: Bearer <SIMPLECAST_API_TOKEN>`, read lazily at call time so the
 *   server can start and list tools without a token configured.
 * - Query params: undefined/null values are stripped before building the URL.
 * - Requests time out after 30s via AbortSignal.
 * - Errors are thrown as SimplecastApiError with an actionable, human-readable message.
 */

const BASE_URL = "https://api.simplecast.com";
const REQUEST_TIMEOUT_MS = 30_000;
const ERROR_BODY_MAX_LENGTH = 500;

export const MISSING_TOKEN_MESSAGE =
  "SIMPLECAST_API_TOKEN is not set. Create a token in Simplecast → Account → Private Apps and set it in your MCP server config.";

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export class SimplecastApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "SimplecastApiError";
    this.status = status;
  }
}

function getToken(): string {
  const token = process.env.SIMPLECAST_API_TOKEN;
  if (!token) {
    throw new SimplecastApiError(MISSING_TOKEN_MESSAGE);
  }
  return token;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}… (truncated)`;
}

function buildUrl(path: string, query?: QueryParams): URL {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${BASE_URL}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function mapErrorResponse(response: Response): Promise<never> {
  const bodyText = truncate(await response.text().catch(() => ""), ERROR_BODY_MAX_LENGTH);
  const status = response.status;

  if (status === 401) {
    throw new SimplecastApiError(
      `Invalid or expired token — check SIMPLECAST_API_TOKEN. (401) ${bodyText}`,
      status
    );
  }
  if (status === 404) {
    throw new SimplecastApiError(
      `Not found — check the id (and note this endpoint may not exist for your plan). (404) ${bodyText}`,
      status
    );
  }
  if (status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const retrySuffix = retryAfter ? ` Retry-After: ${retryAfter}s.` : "";
    throw new SimplecastApiError(
      `Rate limited by Simplecast API (429).${retrySuffix} ${bodyText}`,
      status
    );
  }
  throw new SimplecastApiError(
    `Simplecast API request failed with status ${status}. ${bodyText}`,
    status
  );
}

export class SimplecastClient {
  /**
   * GET request to a Simplecast API path (relative, must start with "/") with optional
   * query parameters. Throws SimplecastApiError on any non-2xx response.
   */
  async request<T = unknown>(path: string, query?: QueryParams): Promise<T> {
    const token = getToken();
    const url = buildUrl(path, query);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        await mapErrorResponse(response);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SimplecastApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SimplecastApiError(
          `Request to Simplecast API timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${path}`
        );
      }
      throw new SimplecastApiError(
        `Network error calling Simplecast API: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * POST request with a JSON body, used for mutating endpoints (e.g. update_podcast).
   */
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const token = getToken();
    const url = buildUrl(path);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });

      if (!response.ok) {
        await mapErrorResponse(response);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SimplecastApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SimplecastApiError(
          `Request to Simplecast API timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${path}`
        );
      }
      throw new SimplecastApiError(
        `Network error calling Simplecast API: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * GET request for the `simplecast_get` escape hatch. Accepts either a path (must start
   * with "/") or a full URL — full URLs are only accepted if their host is api.simplecast.com,
   * and are otherwise rejected to prevent SSRF-style host redirection.
   */
  async getArbitrary<T = unknown>(pathOrUrl: string, query?: QueryParams): Promise<T> {
    const resolvedPath = this.resolvePathOrUrl(pathOrUrl);
    return this.request<T>(resolvedPath, query);
  }

  private resolvePathOrUrl(pathOrUrl: string): string {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pathOrUrl)) {
      // Absolute URL — only allow it if it targets the Simplecast API host.
      let parsed: URL;
      try {
        parsed = new URL(pathOrUrl);
      } catch {
        throw new SimplecastApiError(`Invalid URL passed to simplecast_get: ${pathOrUrl}`);
      }
      if (parsed.host !== new URL(BASE_URL).host) {
        throw new SimplecastApiError(
          `simplecast_get only supports api.simplecast.com URLs; refusing to request host "${parsed.host}".`
        );
      }
      return `${parsed.pathname}${parsed.search}`;
    }

    if (!pathOrUrl.startsWith("/")) {
      throw new SimplecastApiError(`simplecast_get "path" must start with "/" (got "${pathOrUrl}").`);
    }
    return pathOrUrl;
  }
}
