#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, fail } from "../../governed-feature-runtime.mjs";
import { governPromptRequest } from "./cto-governor.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const IS_MAIN = process.argv[1] ? resolve(process.argv[1]) === SCRIPT_PATH : false;

if (IS_MAIN) {
  main().catch((error) => {
    fail(error instanceof Error ? error.stack ?? error.message : String(error));
  });
}

export async function runLauncher(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const inputFile = args.values["input-file"] ?? args.values["prompt-file"];
  const outputFile = args.values["output-file"];
  const projectRoot = args.values["project-root"];

  if (!inputFile) {
    fail("Missing required argument --input-file.");
  }
  if (!outputFile) {
    fail("Missing required argument --output-file.");
  }

  return governPromptRequest({
    promptFile: resolve(inputFile),
    outputFile: resolve(outputFile),
    projectRoot: projectRoot ? resolve(projectRoot) : process.cwd()
  });
}

async function main() {
  await runLauncher(process.argv.slice(2));
}
