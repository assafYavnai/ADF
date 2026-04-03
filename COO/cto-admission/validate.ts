/**
 * COO -> CTO Admission Packet Builder — Input Validation
 *
 * Validates finalized requirement artifacts against the shared contract pack.
 * Uses Zod for schema validation.
 */

import { z } from "zod";
import type { FinalizedRequirementArtifact, SourceMetadataCompleteness } from "./types.js";

const businessPrioritySchema = z.enum(["critical", "high", "medium", "low"]);
const sequencingHintSchema = z.enum(["before", "after", "independent", "any"]);
const executionModeSchema = z.enum(["sequential", "safe-parallel", "dependency-blocked"]);

export const finalizedRequirementSchema = z.object({
  feature_slug: z.string().min(1, "feature_slug is required"),
  requirement_artifact_source: z.string().min(1, "requirement_artifact_source is required"),
  business_priority: businessPrioritySchema,
  claimed_scope_paths: z.array(z.string().min(1)).min(1, "at least one claimed_scope_path is required"),
  non_goals: z.array(z.string()),
  boundaries: z.array(z.string()),
  sequencing_hint: sequencingHintSchema,
  dependency_notes: z.array(z.string()),
  conflict_notes: z.array(z.string()),
  suggested_execution_mode: executionModeSchema,
  requirement_summary: z.string().min(1, "requirement_summary is required"),
  frozen_at: z.string().min(1, "frozen_at is required"),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsed: FinalizedRequirementArtifact | null;
}

export function validateRequirementArtifact(input: unknown): ValidationResult {
  const result = finalizedRequirementSchema.safeParse(input);
  if (result.success) {
    return {
      valid: true,
      errors: [],
      parsed: result.data as FinalizedRequirementArtifact,
    };
  }
  return {
    valid: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    ),
    parsed: null,
  };
}

const REQUIRED_METADATA_FIELDS: (keyof FinalizedRequirementArtifact)[] = [
  "feature_slug",
  "requirement_artifact_source",
  "business_priority",
  "claimed_scope_paths",
  "non_goals",
  "boundaries",
  "sequencing_hint",
  "dependency_notes",
  "conflict_notes",
  "suggested_execution_mode",
  "requirement_summary",
  "frozen_at",
];

export function computeMetadataCompleteness(
  input: Record<string, unknown>
): SourceMetadataCompleteness {
  const missing: string[] = [];
  for (const field of REQUIRED_METADATA_FIELDS) {
    const val = input[field];
    if (val === undefined || val === null || val === "") {
      missing.push(field);
    } else if (Array.isArray(val) && val.length === 0) {
      // Arrays are "present" even if empty — they were explicitly provided
    }
  }
  const total = REQUIRED_METADATA_FIELDS.length;
  const present = total - missing.length;
  return {
    total_fields: total,
    present_fields: present,
    missing_fields: missing,
    completeness_rate: total > 0 ? present / total : 0,
  };
}
