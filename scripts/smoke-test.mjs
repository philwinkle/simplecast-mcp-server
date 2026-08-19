#!/usr/bin/env node
/**
 * Dependency-free smoke test for the built simplecast-mcp-server.
 *
 * Spawns build/index.js with NO SIMPLECAST_API_TOKEN set, speaks raw MCP JSON-RPC over
 * stdio (initialize -> notifications/initialized -> tools/list), and asserts:
 *   1. The server starts and responds to initialize.
 *   2. tools/list returns exactly the expected tool names from tool-spec.md.
 *   3. Calling list_podcasts (no token) returns isError with the missing-token message.
 *
 * Exits 0 on success, 1 on any failure, with a clear message either way.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "..", "build", "index.js");

const EXPECTED_TOOLS = [
  "get_current_user",
  "list_categories",
  "list_timezones",
  "list_distribution_channels",
  "list_podcasts",
  "get_podcast",
  "update_podcast",
  "list_episodes",
  "get_episode",
  "get_episode_markers",
  "list_seasons",
  "get_season_episodes",
  "get_analytics_overview",
  "get_downloads_analytics",
  "get_listener_analytics",
  "get_episodes_analytics",
  "get_location_analytics",
  "get_time_of_week_analytics",
  "get_technology_analytics",
  "get_embed_analytics",
  "get_campaign_analytics",
  "list_keywords",
  "list_authors",
  "get_oembed",
  "simplecast_get",
];

const MISSING_TOKEN_MESSAGE_FRAGMENT = "SIMPLECAST_API_TOKEN is not set";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

async function main() {
  // Explicitly strip any token so the server starts/lists tools tokenless, per spec.
  const env = { ...process.env };
  delete env.SIMPLECAST_API_TOKEN;

  const child = spawn(process.execPath, [serverPath], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderrBuf = "";
  child.stderr.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });

  let stdoutBuf = "";
  const pendingResolvers = new Map();
  let nextId = 1;

  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString();
    let newlineIndex;
    while ((newlineIndex = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, newlineIndex).trim();
      stdoutBuf = stdoutBuf.slice(newlineIndex + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        fail(`Server wrote non-JSON line to stdout (protocol corruption?): ${line}`);
        continue;
      }
      if (message && typeof message.id !== "undefined" && pendingResolvers.has(message.id)) {
        const resolve = pendingResolvers.get(message.id);
        pendingResolvers.delete(message.id);
        resolve(message);
      }
    }
  });

  function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function request(method, params) {
    const id = nextId++;
    const responsePromise = new Promise((resolve, reject) => {
      pendingResolvers.set(id, resolve);
      setTimeout(() => {
        if (pendingResolvers.has(id)) {
          pendingResolvers.delete(id);
          reject(new Error(`Timed out waiting for response to ${method} (id ${id})`));
        }
      }, 10_000);
    });
    send({ jsonrpc: "2.0", id, method, params });
    return responsePromise;
  }

  function notify(method, params) {
    send({ jsonrpc: "2.0", method, params });
  }

  const exitPromise = new Promise((resolve) => {
    child.on("exit", (code) => resolve(code));
  });

  try {
    // 1. initialize
    const initResponse = await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.0.0" },
    });

    if (initResponse.error) {
      fail(`initialize returned an error: ${JSON.stringify(initResponse.error)}`);
    } else if (!initResponse.result || !initResponse.result.serverInfo) {
      fail(`initialize response missing result.serverInfo: ${JSON.stringify(initResponse)}`);
    } else {
      console.error(
        `OK: initialize -> server "${initResponse.result.serverInfo.name}" v${initResponse.result.serverInfo.version}`
      );
    }

    // 2. notifications/initialized
    notify("notifications/initialized", {});

    // 3. tools/list
    const toolsResponse = await request("tools/list", {});
    if (toolsResponse.error) {
      fail(`tools/list returned an error: ${JSON.stringify(toolsResponse.error)}`);
    } else {
      const toolNames = (toolsResponse.result?.tools ?? []).map((t) => t.name);
      const missing = EXPECTED_TOOLS.filter((name) => !toolNames.includes(name));
      const unexpected = toolNames.filter((name) => !EXPECTED_TOOLS.includes(name));

      if (missing.length > 0) {
        fail(`tools/list is missing expected tools: ${missing.join(", ")}`);
      } else {
        console.error(`OK: tools/list returned all ${EXPECTED_TOOLS.length} expected tools`);
      }
      if (unexpected.length > 0) {
        console.error(
          `NOTE: tools/list returned unexpected extra tools (not necessarily a failure): ${unexpected.join(", ")}`
        );
      }

      // Every tool should have a non-empty description.
      const missingDescriptions = (toolsResponse.result?.tools ?? [])
        .filter((t) => !t.description || t.description.trim().length === 0)
        .map((t) => t.name);
      if (missingDescriptions.length > 0) {
        fail(`Tools missing a description: ${missingDescriptions.join(", ")}`);
      }
    }

    // 4. call list_podcasts with no token configured -> expect isError with actionable message
    const callResponse = await request("tools/call", {
      name: "list_podcasts",
      arguments: {},
    });

    if (callResponse.error) {
      fail(`tools/call list_podcasts returned a protocol-level error (expected a tool-level isError result): ${JSON.stringify(callResponse.error)}`);
    } else {
      const result = callResponse.result;
      const text = result?.content?.[0]?.text ?? "";
      if (result?.isError !== true) {
        fail(`tools/call list_podcasts without a token should return isError:true, got: ${JSON.stringify(result)}`);
      } else if (!text.includes(MISSING_TOKEN_MESSAGE_FRAGMENT)) {
        fail(`tools/call list_podcasts error message missing expected text "${MISSING_TOKEN_MESSAGE_FRAGMENT}": ${text}`);
      } else {
        console.error("OK: list_podcasts without a token returns isError with the missing-token message");
      }
    }

    // 5. call get_embed_analytics with report=heatmap (episode-only) + podcast_id -> expect a
    //    scope-validation isError mentioning "episode", raised before any network call is made
    //    (so it doesn't require a token).
    const heatmapResponse = await request("tools/call", {
      name: "get_embed_analytics",
      arguments: { report: "heatmap", podcast_id: "11111111-1111-1111-1111-111111111111" },
    });

    if (heatmapResponse.error) {
      fail(
        `tools/call get_embed_analytics(report=heatmap, podcast_id=...) returned a protocol-level error (expected a tool-level isError result): ${JSON.stringify(heatmapResponse.error)}`
      );
    } else {
      const result = heatmapResponse.result;
      const text = result?.content?.[0]?.text ?? "";
      if (result?.isError !== true) {
        fail(
          `get_embed_analytics(report=heatmap, podcast_id=...) should return isError:true (heatmap is episode-only), got: ${JSON.stringify(result)}`
        );
      } else if (!text.toLowerCase().includes("episode")) {
        fail(`get_embed_analytics(report=heatmap) error message should mention "episode": ${text}`);
      } else {
        console.error("OK: get_embed_analytics(report=heatmap, podcast_id=...) returns isError naming episode_id");
      }
    }
  } catch (error) {
    fail(`Unexpected error during smoke test: ${error?.stack ?? error}`);
  } finally {
    child.stdin.end();
    child.kill();
    await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 2000))]);
  }

  if (process.exitCode === 1) {
    console.error("\nSMOKE TEST FAILED");
    if (stderrBuf.trim()) {
      console.error("--- server stderr ---");
      console.error(stderrBuf);
    }
    process.exit(1);
  } else {
    console.error("\nSMOKE TEST PASSED");
    process.exit(0);
  }
}

main();
