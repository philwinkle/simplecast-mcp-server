#!/usr/bin/env node
/**
 * Builds the Claude Desktop Extension bundle: dist/simplecast-mcp-server.mcpb.
 *
 * Steps:
 *  1. `npm run build` so build/ is fresh.
 *  2. Stage a clean bundle directory (dist/mcpb-stage/) containing only what the extension
 *     needs at runtime: manifest.json, build/, package.json(+lock), LICENSE, and a
 *     *production-only* node_modules installed fresh into the stage. Packing a fresh install
 *     here (rather than `mcpb pack .`) keeps devDependencies -- including the mcpb CLI itself,
 *     typescript, and this repo's .git history -- out of the shipped .mcpb file.
 *  3. `mcpb validate` the staged manifest, then `mcpb pack` the staged directory into
 *     dist/simplecast-mcp-server.mcpb.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, cpSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const stageDir = path.join(distDir, "mcpb-stage");
const outputBundle = path.join(distDir, "simplecast-mcp-server.mcpb");
const manifestPath = path.join(repoRoot, "manifest.json");
const mcpbBin = path.join(repoRoot, "node_modules", ".bin", "mcpb");

function run(command, args, opts = {}) {
  console.error(`-> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", cwd: repoRoot, ...opts });
  if (result.error) {
    console.error(`FAIL: could not run "${command} ${args.join(" ")}": ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`FAIL: "${command} ${args.join(" ")}" exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  if (!existsSync(manifestPath)) {
    console.error(`FAIL: manifest.json not found at ${manifestPath}`);
    process.exit(1);
  }
  if (!existsSync(mcpbBin)) {
    console.error(
      `FAIL: ${path.relative(repoRoot, mcpbBin)} not found. Run "npm install" (mcpb is a devDependency) first.`
    );
    process.exit(1);
  }

  run("npm", ["run", "build"]);

  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });

  copyFileSync(manifestPath, path.join(stageDir, "manifest.json"));
  cpSync(path.join(repoRoot, "build"), path.join(stageDir, "build"), { recursive: true });
  copyFileSync(path.join(repoRoot, "package.json"), path.join(stageDir, "package.json"));
  const lockPath = path.join(repoRoot, "package-lock.json");
  if (existsSync(lockPath)) copyFileSync(lockPath, path.join(stageDir, "package-lock.json"));
  const licensePath = path.join(repoRoot, "LICENSE");
  if (existsSync(licensePath)) copyFileSync(licensePath, path.join(stageDir, "LICENSE"));

  // Fresh, production-only install inside the stage (this repo's node_modules is not copied in).
  run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: stageDir });

  run(mcpbBin, ["validate", path.join(stageDir, "manifest.json")]);

  mkdirSync(distDir, { recursive: true });
  if (existsSync(outputBundle)) rmSync(outputBundle);
  run(mcpbBin, ["pack", stageDir, outputBundle]);

  if (!existsSync(outputBundle)) {
    console.error(`FAIL: expected ${path.relative(repoRoot, outputBundle)} to exist after packing.`);
    process.exit(1);
  }

  console.error(`OK: wrote ${path.relative(repoRoot, outputBundle)}`);
}

main();
