import { z } from "zod";

export const SelfRepairEngineSchemaVersion = z.literal("1.0");

export const SelfRepairEngineName = z.enum([
  "startup",
  "board-review",
  "parse-auto-fix",
  "self-learning-engine",
  "rules-compliance-enforcer",
]);

export const SelfRepairIncidentType = z.enum([
  "invalid_runtime_artifact",
  "missing_runtime_artifact",
  "provider_cli_failure",
]);

export const SelfRepairAction = z.enum([
  "regenerated_artifact",
  "cold_start_retry",
  "none",
]);

export const SelfRepairStatus = z.enum([
  "repaired",
  "escalated",
]);

export const SelfRepairIncidentSchema = z.object({
  schema_version: SelfRepairEngineSchemaVersion,
  component: z.string(),
  request_job_id: z.string(),
  engine: SelfRepairEngineName,
  incident_type: SelfRepairIncidentType,
  run_dir: z.string(),
  message: z.string(),
  round: z.number().int().nonnegative().nullable().optional(),
  slot_key: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  target_path: z.string().nullable().optional(),
  details: z.record(z.unknown()).default({}),
  observed_at: z.string(),
});

export const SelfRepairResultSchema = z.object({
  schema_version: SelfRepairEngineSchemaVersion,
  component: z.string(),
  request_job_id: z.string(),
  engine: SelfRepairEngineName,
  incident_type: SelfRepairIncidentType,
  status: SelfRepairStatus,
  action: SelfRepairAction,
  message: z.string(),
  attempt_dir: z.string(),
  incident_path: z.string(),
  result_path: z.string(),
  backup_path: z.string().nullable().optional(),
  updated_artifact_path: z.string().nullable().optional(),
  primary_error: z.string().nullable().optional(),
  repair_error: z.string().nullable().optional(),
  completed_at: z.string(),
});

export type SelfRepairIncident = z.infer<typeof SelfRepairIncidentSchema>;
export type SelfRepairResult = z.infer<typeof SelfRepairResultSchema>;
