#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(__filename), "..");

const [{ MemoryEngineClient }] = await Promise.all([
  import(pathToFileURL(join(repoRoot, "COO", "dist", "COO", "controller", "memory-engine-client.js")).href),
]);

let client;
try {
  client = await MemoryEngineClient.connect(repoRoot, {
    telemetryContext: {
      doctor_probe: "bash-runtime-connect-smoke",
    },
  });
  await client.close();
  console.log(JSON.stringify({ status: "ok" }));
} finally {
  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close failures in smoke verification.
    }
  }
}
