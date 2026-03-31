import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  SelfRepairIncidentSchema,
  SelfRepairResultSchema,
  type SelfRepairIncident,
  type SelfRepairResult,
} from "./schemas/contract.js";

export async function repairRuntimeArtifact(params: {
  component: string;
  requestJobId: string;
  runDir: string;
  engine: SelfRepairIncident["engine"];
  incidentType: "invalid_runtime_artifact" | "missing_runtime_artifact";
  message: string;
  targetPath: string;
  replacementText: string;
  details?: Record<string, unknown>;
  round?: number | null;
  slotKey?: string | null;
}): Promise<SelfRepairResult> {
  const incident = SelfRepairIncidentSchema.parse({
    schema_version: "1.0",
    component: params.component,
    request_job_id: params.requestJobId,
    engine: params.engine,
    incident_type: params.incidentType,
    run_dir: params.runDir,
    message: params.message,
    round: params.round ?? null,
    slot_key: params.slotKey ?? null,
    provider: null,
    model: null,
    target_path: normalizePath(params.targetPath),
    details: params.details ?? {},
    observed_at: new Date().toISOString(),
  });

  const attemptDir = await createAttemptDir(params.runDir, params.incidentType);
  const incidentPath = join(attemptDir, "incident.json");
  await writeFile(incidentPath, JSON.stringify(incident, null, 2), "utf-8");

  let backupPath: string | null = null;
  try {
    const existing = await readFile(params.targetPath, "utf-8");
    backupPath = join(attemptDir, `${basename(params.targetPath)}.backup`);
    await writeFile(backupPath, existing, "utf-8");
  } catch {
    backupPath = null;
  }

  await mkdir(dirname(params.targetPath), { recursive: true });
  await writeFile(params.targetPath, params.replacementText, "utf-8");

  const result = SelfRepairResultSchema.parse({
    schema_version: "1.0",
    component: params.component,
    request_job_id: params.requestJobId,
    engine: params.engine,
    incident_type: params.incidentType,
    status: "repaired",
    action: "regenerated_artifact",
    message: params.message,
    attempt_dir: normalizePath(attemptDir),
    incident_path: normalizePath(incidentPath),
    result_path: normalizePath(join(attemptDir, "result.json")),
    backup_path: backupPath ? normalizePath(backupPath) : null,
    updated_artifact_path: normalizePath(params.targetPath),
    primary_error: null,
    repair_error: null,
    completed_at: new Date().toISOString(),
  });
  await writeFile(join(attemptDir, "result.json"), JSON.stringify(result, null, 2), "utf-8");
  return result;
}

export async function invokeWithSelfRepair<T>(params: {
  component: string;
  requestJobId: string;
  runDir: string;
  engine: SelfRepairIncident["engine"];
  message: string;
  provider: string;
  model: string;
  details?: Record<string, unknown>;
  round?: number | null;
  slotKey?: string | null;
  primary: () => Promise<T>;
  repair: () => Promise<T>;
}): Promise<{
  value: T;
  repair: SelfRepairResult | null;
}> {
  try {
    const value = await params.primary();
    return { value, repair: null };
  } catch (primaryError) {
    const attemptDir = await createAttemptDir(params.runDir, "provider_cli_failure");
    const incidentPath = join(attemptDir, "incident.json");
    const incident = SelfRepairIncidentSchema.parse({
      schema_version: "1.0",
      component: params.component,
      request_job_id: params.requestJobId,
      engine: params.engine,
      incident_type: "provider_cli_failure",
      run_dir: params.runDir,
      message: params.message,
      round: params.round ?? null,
      slot_key: params.slotKey ?? null,
      provider: params.provider,
      model: params.model,
      target_path: null,
      details: params.details ?? {},
      observed_at: new Date().toISOString(),
    });
    await writeFile(incidentPath, JSON.stringify(incident, null, 2), "utf-8");

    if (!isRetryableProviderFailure(primaryError)) {
      const escalated = SelfRepairResultSchema.parse({
        schema_version: "1.0",
        component: params.component,
        request_job_id: params.requestJobId,
        engine: params.engine,
        incident_type: "provider_cli_failure",
        status: "escalated",
        action: "none",
        message: `${params.message} is not repairable by bounded cold-start retry`,
        attempt_dir: normalizePath(attemptDir),
        incident_path: normalizePath(incidentPath),
        result_path: normalizePath(join(attemptDir, "result.json")),
        backup_path: null,
        updated_artifact_path: null,
        primary_error: errorMessage(primaryError),
        repair_error: null,
        completed_at: new Date().toISOString(),
      });
      await writeFile(join(attemptDir, "result.json"), JSON.stringify(escalated, null, 2), "utf-8");
      throw attachRepairAudit(primaryError, escalated);
    }

    try {
      const value = await params.repair();
      const repaired = SelfRepairResultSchema.parse({
        schema_version: "1.0",
        component: params.component,
        request_job_id: params.requestJobId,
        engine: params.engine,
        incident_type: "provider_cli_failure",
        status: "repaired",
        action: "cold_start_retry",
        message: `${params.message} recovered after one cold-start retry`,
        attempt_dir: normalizePath(attemptDir),
        incident_path: normalizePath(incidentPath),
        result_path: normalizePath(join(attemptDir, "result.json")),
        backup_path: null,
        updated_artifact_path: null,
        primary_error: errorMessage(primaryError),
        repair_error: null,
        completed_at: new Date().toISOString(),
      });
      await writeFile(join(attemptDir, "result.json"), JSON.stringify(repaired, null, 2), "utf-8");
      return { value, repair: repaired };
    } catch (repairError) {
      const escalated = SelfRepairResultSchema.parse({
        schema_version: "1.0",
        component: params.component,
        request_job_id: params.requestJobId,
        engine: params.engine,
        incident_type: "provider_cli_failure",
        status: "escalated",
        action: "cold_start_retry",
        message: `${params.message} still failed after bounded cold-start retry`,
        attempt_dir: normalizePath(attemptDir),
        incident_path: normalizePath(incidentPath),
        result_path: normalizePath(join(attemptDir, "result.json")),
        backup_path: null,
        updated_artifact_path: null,
        primary_error: errorMessage(primaryError),
        repair_error: errorMessage(repairError),
        completed_at: new Date().toISOString(),
      });
      await writeFile(join(attemptDir, "result.json"), JSON.stringify(escalated, null, 2), "utf-8");
      throw attachRepairAudit(repairError, escalated);
    }
  }
}

function isRetryableProviderFailure(error: unknown): boolean {
  if (error && typeof error === "object" && "attempts" in error && Array.isArray((error as { attempts?: unknown[] }).attempts)) {
    return true;
  }

  const message = errorMessage(error);
  return /timed out|failed \(exit|spawn|enoent|econn|epipe|taskkill|terminated/i.test(message);
}

async function createAttemptDir(runDir: string, incidentType: SelfRepairIncident["incident_type"]): Promise<string> {
  const attemptDir = join(runDir, "runtime", "self-repair-engine", `${new Date().toISOString().replace(/[:.]/g, "-")}-${incidentType}-${randomUUID()}`);
  await mkdir(attemptDir, { recursive: true });
  return attemptDir;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function attachRepairAudit(error: unknown, repair: SelfRepairResult): Error {
  const message = `${errorMessage(error)} Self-repair result: ${repair.result_path}`;
  const nextError = new Error(message);
  (nextError as Error & { cause?: unknown }).cause = error;
  return nextError;
}
