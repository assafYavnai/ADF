#!/usr/bin/env node

import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(args["repo-root"] ?? process.cwd());
const operation = requiredArg(args, "operation");
const latencyMs = parseNonNegativeInteger(requiredArg(args, "latency-ms"), "latency-ms");
const success = parseBoolean(requiredArg(args, "success"), "success");
const sourcePath = args["source-path"] ?? `ADF/launcher/${operation}`;
const telemetryPartition = args["telemetry-partition"] ?? process.env.ADF_TELEMETRY_PARTITION ?? "production";
const proofRunId = args["proof-run-id"] ?? process.env.ADF_TELEMETRY_PROOF_RUN_ID ?? null;
const workflow = args.workflow ?? "adf_launcher";
const routeName = args["route-name"] ?? null;
const routeStage = args["route-stage"] ?? null;
const stepName = args["step-name"] ?? null;
const traceId = args["trace-id"] ?? null;
const resultStatus = args["result-status"] ?? (success ? "success" : "failed");
const entrySurface = args["entry-surface"] ?? "adf_launcher";
const controlPlaneKind = args["control-plane-kind"] ?? null;
const entrypoint = args.entrypoint ?? null;
const errorClass = args["error-class"] ?? null;
const errorMessage = args["error-message"] ?? null;
const emitJson = parseOptionalBoolean(args.json);
const outboxPath = resolve(repoRoot, "memory", "launcher-telemetry-outbox.json");

const provenance = await importModule(repoRoot, "shared", "dist", "provenance", "types.js");
const event = {
  provenance: provenance.createSystemProvenance(sourcePath),
  category: "system",
  operation,
  latency_ms: latencyMs,
  success,
  metadata: compactObject({
    telemetry_partition: telemetryPartition,
    workflow,
    route_name: routeName,
    route_stage: routeStage,
    step_name: stepName,
    trace_id: traceId,
    result_status: resultStatus,
    runtime_entry_surface: entrySurface,
    control_plane_kind: controlPlaneKind,
    entrypoint,
    proof_run_id: proofRunId,
    proof_mode: telemetryPartition === "proof",
    error_class: errorClass,
    error_message: errorMessage,
  }),
};

let brainClient = null;
let replayedEvents = 0;
let closeResult = {
  status: "spooled",
  pending_events: 1,
  outbox_path: outboxPath,
};

const memoryEngineClientPath = resolve(repoRoot, "COO", "dist", "COO", "controller", "memory-engine-client.js");
if (await pathExists(memoryEngineClientPath)) {
  try {
    const { MemoryEngineClient } = await import(pathToFileURL(memoryEngineClientPath).href);
    brainClient = await MemoryEngineClient.connect(repoRoot, {
      telemetryContext: {
        telemetry_partition: telemetryPartition,
        runtime_entry_surface: entrySurface,
        proof_mode: telemetryPartition === "proof",
      },
    });
    const persistedEvents = await readOutbox(outboxPath);
    if (persistedEvents.length > 0) {
      await brainClient.emitMetricsBatch(persistedEvents);
      await rm(outboxPath, { force: true });
      replayedEvents = persistedEvents.length;
    }
    event.metadata = {
      ...event.metadata,
      replayed_events: replayedEvents,
    };
    await brainClient.emitMetric(event);
    closeResult = {
      status: "drained",
      pending_events: 0,
      outbox_path: outboxPath,
    };
  } catch {
    brainClient = null;
  }
}

if (!brainClient) {
  const pendingEvents = await appendOutbox(outboxPath, [event]);
  closeResult = {
    status: "spooled",
    pending_events: pendingEvents,
    outbox_path: outboxPath,
  };
}

if (brainClient) {
  await brainClient.close().catch(() => {});
}

if (emitJson === true) {
  process.stdout.write(JSON.stringify({
    operation,
    telemetry_partition: telemetryPartition,
    connected_to_brain: Boolean(brainClient),
    replayed_events: replayedEvents,
    close_status: closeResult.status ?? "unknown",
    pending_events: closeResult.pending_events ?? 0,
    outbox_path: closeResult.outbox_path ?? outboxPath,
  }, null, 2) + "\n");
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "") {
      continue;
    }
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

function parseBoolean(value, key) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected --${key} to be true or false, got '${value}'.`);
}

function parseOptionalBoolean(value) {
  if (value === undefined) {
    return null;
  }
  return parseBoolean(String(value), "json");
}

function parseNonNegativeInteger(value, key) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected --${key} to be a non-negative integer, got '${value}'.`);
  }
  return parsed;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined && entry !== "")
  );
}

async function importModule(repoRootPath, ...relativeSegments) {
  return import(pathToFileURL(join(repoRootPath, ...relativeSegments)).href);
}

async function appendOutbox(targetPath, events) {
  const existing = await readOutbox(targetPath);
  const merged = [...existing, ...events];
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged.length;
}

async function readOutbox(targetPath) {
  try {
    const raw = await readFile(targetPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    return [];
  }
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
