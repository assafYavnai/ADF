#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..");
const payloadPath = process.argv[2];

if (!payloadPath) {
  console.error("Usage: node tools/doctor-brain-audit.mjs <payload.json>");
  process.exit(1);
}

const payload = JSON.parse(await readFile(payloadPath, "utf8"));

const [{ MemoryEngineClient }, { createSystemProvenance }] = await Promise.all([
  import(pathToFileURL(join(repoRoot, "COO", "dist", "COO", "controller", "memory-engine-client.js")).href),
  import(pathToFileURL(join(repoRoot, "shared", "provenance", "types.js")).href),
]);

const client = await MemoryEngineClient.connect(repoRoot, {
  telemetryContext: {
    doctor_run_id: payload.run_id,
    doctor_outcome: payload.outcome,
  },
});

try {
  const result = await client.captureMemory(
    {
      title: payload.title,
      summary: payload.summary,
      outcome: payload.outcome,
      started_at: payload.started_at,
      completed_at: payload.completed_at,
      repairs_attempted: payload.repairs_attempted ?? [],
      checks: payload.checks ?? [],
      local_report_path: payload.local_report_path ?? null,
    },
    "finding",
    payload.tags ?? ["doctor", "mcp-health", "audit"],
    payload.scope ?? "assafyavnai/adf",
    createSystemProvenance("tools/doctor-brain-audit"),
    {
      doctor_run_id: payload.run_id,
      doctor_outcome: payload.outcome,
    },
  );

  console.log(JSON.stringify({
    status: "logged",
    result,
  }));
} finally {
  await client.close();
}
