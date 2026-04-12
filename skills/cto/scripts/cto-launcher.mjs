#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, fail } from "../../governed-feature-runtime.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_PATH);
const GOVERNOR_PATH = join(SCRIPT_DIR, "cto-governor.mjs");

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputFile = args.values["input-file"] ?? args.values["prompt-file"];
  const outputFile = args.values["output-file"];
  const projectRoot = args.values["project-root"];

  if (!inputFile) {
    fail("Missing required argument --input-file.");
  }
  if (!outputFile) {
    fail("Missing required argument --output-file.");
  }

  const cliArgs = [
    GOVERNOR_PATH,
    "--prompt-file",
    resolve(inputFile),
    "--output-file",
    resolve(outputFile)
  ];

  if (projectRoot) {
    cliArgs.push("--project-root", projectRoot);
  }

  const result = spawnSync(process.execPath, cliArgs, {
    cwd: projectRoot ? resolve(projectRoot) : process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `cto-governor exited ${result.status}`);
  }

  process.stdout.write(result.stdout);
}
