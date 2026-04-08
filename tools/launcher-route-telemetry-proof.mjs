#!/usr/bin/env node

import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildValidation, summarizeOperations } from "./launcher-route-telemetry-proof-lib.mjs";

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(args["repo-root"] ?? process.cwd());
const proofRunId = requiredArg(args, "proof-run-id");
const sourcePathPrefix = args["source-path-prefix"] ?? "ADF/launcher/";
const expectCmdFrontdoor = parseOptionalBoolean(args["expect-cmd-frontdoor"]) === true;

const { pool } = await import(pathToFileURL(join(repoRoot, "components", "memory-engine", "dist", "db", "connection.js")).href);

try {
  const rowsResult = await pool.query(
    `SELECT
       source_path,
       operation,
       latency_ms,
       success,
       created_at,
       COALESCE(NULLIF(metadata->>'telemetry_partition', ''), 'production') AS telemetry_partition,
       COALESCE(NULLIF(metadata->>'workflow', ''), '') AS workflow,
       COALESCE(NULLIF(metadata->>'route_name', ''), '') AS route_name,
       COALESCE(NULLIF(metadata->>'route_stage', ''), '') AS route_stage,
       COALESCE(NULLIF(metadata->>'step_name', ''), '') AS step_name,
       COALESCE(NULLIF(metadata->>'trace_id', ''), '') AS trace_id,
       COALESCE(NULLIF(metadata->>'result_status', ''), '') AS result_status,
       COALESCE(NULLIF(metadata->>'runtime_entry_surface', ''), '') AS runtime_entry_surface,
       COALESCE(NULLIF(metadata->>'control_plane_kind', ''), '') AS control_plane_kind,
       COALESCE(NULLIF(metadata->>'entrypoint', ''), '') AS entrypoint,
       COALESCE(NULLIF(metadata->>'proof_run_id', ''), '') AS proof_run_id
     FROM telemetry
     WHERE source_path LIKE $1
       AND COALESCE(NULLIF(metadata->>'proof_run_id', ''), '') = $2
     ORDER BY created_at ASC`,
    [`${sourcePathPrefix}%`, proofRunId],
  );

  const partitionResult = await pool.query(
    `SELECT
       COALESCE(NULLIF(metadata->>'telemetry_partition', ''), 'production') AS telemetry_partition,
       COUNT(*)::int AS total_events
     FROM telemetry
     WHERE source_path LIKE $1
       AND COALESCE(NULLIF(metadata->>'proof_run_id', ''), '') = $2
     GROUP BY COALESCE(NULLIF(metadata->>'telemetry_partition', ''), 'production')
     ORDER BY telemetry_partition ASC`,
    [`${sourcePathPrefix}%`, proofRunId],
  );

  const rows = rowsResult.rows;
  const partitionCounts = partitionResult.rows;
  const operationSummary = summarizeOperations(rows);
  const validation = buildValidation(rows, partitionCounts, { expectCmdFrontdoor });

  const payload = {
    proof_run_id: proofRunId,
    source_path_prefix: sourcePathPrefix,
    expect_cmd_frontdoor: expectCmdFrontdoor,
    total_events: rows.length,
    partition_counts: partitionCounts,
    operations: operationSummary,
    rows,
    validation,
  };

  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");

  if (!payload.validation.valid) {
    process.exit(1);
  }
} finally {
  await pool.end().catch(() => {});
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function requiredArg(argsMap, key) {
  const value = argsMap[key];
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`Missing required argument --${key}.`);
  }
  return String(value);
}

function parseOptionalBoolean(value) {
  if (value === undefined) {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Expected optional boolean value to be true or false, got '${value}'.`);
}
