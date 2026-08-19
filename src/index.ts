#!/usr/bin/env node
/**
 * Simplecast MCP server entry point.
 *
 * IMPORTANT: this process communicates over stdio using the MCP protocol. Never write
 * anything to stdout except protocol messages (handled by the SDK transport) — use
 * console.error for any diagnostics/logging.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SimplecastClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";
import { VERSION } from "./version.js";

async function main(): Promise<void> {
  const server = new McpServer({
    name: "simplecast",
    version: VERSION,
  });

  const client = new SimplecastClient();
  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("simplecast-mcp-server: connected over stdio");
}

main().catch((error) => {
  console.error("simplecast-mcp-server: fatal error", error);
  process.exit(1);
});
