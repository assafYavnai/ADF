#!/usr/bin/env node

import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(args["repo-root"] ?? process.cwd());
const proofRunId = requiredArg(args, "proof-run-id");
const sourcePathPrefix = args["source-path-prefix"] ?? "ADF/launcher/";
const requiredOperations = [
  "launcher_runtime_preflight",
  "launcher_install",
  "launcher_launch_preflight",
];

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
  const missingOperations = requiredOperations.filter((operation) => !operationSummary.some((entry) => entry.operation === operation));
  const hasProofRows = partitionCounts.some((entry) => entry.telemetry_partition === "proof" && Number(entry.total_events ?? 0) > 0);
  const hasCmdProof = rows.some((row) =>
    row.operation === "launcher_runtime_preflight"
    && row.control_plane_kind === "windows-cmd-trampoline"
    && row.entrypoint === "adf.cmd"
  );

  const payload = {
    proof_run_id: proofRunId,
    source_path_prefix: sourcePathPrefix,
    total_events: rows.length,
    partition_counts: partitionCounts,
    operations: operationSummary,
    rows,
    validation: {
      has_proof_rows: hasProofRows,
      missing_required_operations: missingOperations,
      has_cmd_trampoline_runtime_preflight: hasCmdProof,
      valid: hasProofRows && missingOperations.length === 0 && hasCmdProof,
    },
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

function summarizeOperations(rows) {
  const summaries = new Map();

  for (const row of rows) {
    if (!summaries.has(row.operation)) {
      summaries.set(row.operation, {
        operation: row.operation,
        total_events: 0,
        success_count: 0,
        failure_count: 0,
        route_stages: new Set(),
        step_names: new Set(),
      });
    }

    const summary = summaries.get(row.operation);
    summary.total_events += 1;
    summary.success_count += row.success ? 1 : 0;
    summary.failure_count += row.success ? 0 : 1;
    if (row.route_stage) {
      summary.route_stages.add(row.route_stage);
    }
    if (row.step_name) {
      summary.step_names.add(row.step_name);
    }
  }

  return Array.from(summaries.values()).map((summary) => ({
    operation: summary.operation,
    total_events: summary.total_events,
    success_count: summary.success_count,
    failure_count: summary.failure_count,
    route_stages: Array.from(summary.route_stages.values()),
    step_names: Array.from(summary.step_names.values()),
  }));
}
