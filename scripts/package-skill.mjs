#!/usr/bin/env node
/**
 * Packages skills/simplecast/ into dist/simplecast-skill.zip, with the skill folder at the
 * zip root as "simplecast/" (i.e. "simplecast/SKILL.md", "simplecast/references/api-notes.md"),
 * ready to upload via Claude Desktop/claude.ai Settings -> Capabilities -> Skills, or to copy
 * into ~/.claude/skills/ for Claude Code.
 *
 * Prefers the system `zip` binary (spawned directly, no archiver dependency). Falls back to
 * Python's stdlib zipfile module (also spawned directly, no extra dependency) if `zip` isn't
 * on PATH, since both are commonly available and neither requires adding a package dependency.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const skillsDir = path.join(repoRoot, "skills");
const skillFolderName = "simplecast";
const distDir = path.join(repoRoot, "dist");
const outputZip = path.join(distDir, "simplecast-skill.zip");

function commandExists(cmd) {
  const result = spawnSync(cmd, ["-h"], { stdio: "ignore" });
  return !result.error;
}

function packWithZipCli() {
  const result = spawnSync("zip", ["-r", "-X", outputZip, skillFolderName], {
    cwd: skillsDir,
    stdio: "inherit",
  });
  return result.status === 0;
}

function packWithPython() {
  const python = commandExists("python3") ? "python3" : commandExists("python") ? "python" : null;
  if (!python) return false;

  const script = `
import os, sys, zipfile
skills_dir = ${JSON.stringify(skillsDir)}
folder = ${JSON.stringify(skillFolderName)}
out = ${JSON.stringify(outputZip)}
root = os.path.join(skills_dir, folder)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        for name in filenames:
            full = os.path.join(dirpath, name)
            arcname = os.path.join(folder, os.path.relpath(full, root))
            zf.write(full, arcname)
`;
  const result = spawnSync(python, ["-c", script], { stdio: "inherit" });
  return result.status === 0;
}

function main() {
  const skillManifest = path.join(skillsDir, skillFolderName, "SKILL.md");
  if (!existsSync(skillManifest)) {
    console.error(`FAIL: expected ${path.relative(repoRoot, skillManifest)} to exist.`);
    process.exit(1);
  }

  mkdirSync(distDir, { recursive: true });
  if (existsSync(outputZip)) rmSync(outputZip);

  let ok = false;
  if (commandExists("zip")) {
    console.error("-> packing with `zip`");
    ok = packWithZipCli();
  } else {
    console.error("-> `zip` not found on PATH, falling back to python3 zipfile");
    ok = packWithPython();
  }

  if (!ok || !existsSync(outputZip)) {
    console.error(
      "FAIL: could not produce the skill zip (neither `zip` nor a working python3/python interpreter was usable)."
    );
    process.exit(1);
  }

  console.error(`OK: wrote ${path.relative(repoRoot, outputZip)}`);
}

main();
