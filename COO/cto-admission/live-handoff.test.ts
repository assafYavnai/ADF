import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  handoffFinalizedRequirementToCtoAdmission,
  updateCtoAdmissionDecision,
} from "./index.js";
import { RequirementArtifact } from "../requirements-gathering/contracts/onion-artifact.js";

const BASE_MEMORY_ID = "11111111-1111-4111-8111-111111111111";

async function createProjectRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, "docs", "phase1"), { recursive: true });
  return root;
}

function buildRequirementArtifact(overrides: Partial<ReturnType<typeof RequirementArtifact.parse>> = {}) {
  return RequirementArtifact.parse({
    schema_version: "1.0",
    artifact_kind: "requirement_list",
    artifact_id: "artifact-live-admission-001",
    source_approval_turn_id: "turn-010",
    human_scope: {
      approved_turn_id: "turn-010",
      approved_at: "2026-04-03T08:00:00.000Z",
      topic: "COO Freeze To CTO Admission Wiring",
      goal: "Persist CTO admission artifacts directly from the live finalized requirement.",
      expected_result: "The COO writes a CTO admission packet without manual reinterpretation.",
      success_view: "The feature folder contains the request, decision template, and summary files.",
      major_parts: [
        { id: "handoff", label: "Live handoff", order: 0 },
        { id: "artifacts", label: "Artifact persistence", order: 1 },
      ],
      part_clarifications: {
        handoff: {
          part_id: "handoff",
          detail: "Use the real finalized requirement artifact from the freeze path.",
          questions_answered: ["What source should power CTO admission?"],
          status: "clarified",
        },
      },
      experience_ui: {
        relevant: false,
        preview_status: "not_needed",
      },
      boundaries: [
        { id: "no_queue_engine", kind: "non_goal", statement: "Do not build a queue engine in this slice." },
        { id: "coo_owned_state", kind: "constraint", statement: "Admission status must persist in COO-owned state." },
      ],
      open_decisions: [],
    },
    requirement_items: [
      {
        id: "requirement:handoff",
        title: "Wire the finalized requirement into CTO admission",
        detail: "Consume the real finalized requirement artifact from the live freeze path.",
        source_refs: ["approved.topic", "approved.goal"],
        meaning_preservation: "verbatim_from_approved_snapshot",
      },
      {
        id: "requirement:artifacts",
        title: "Persist the three CTO admission artifacts",
        detail: "Write the request, decision template, and summary under the deterministic feature root.",
        source_refs: ["approved.expected_result", "approved.success_view"],
        meaning_preservation: "verbatim_from_approved_snapshot",
      },
    ],
    explicit_boundaries: [
      { id: "no_queue_engine", kind: "non_goal", statement: "Do not build a queue engine in this slice." },
      { id: "coo_owned_state", kind: "constraint", statement: "Admission status must persist in COO-owned state." },
    ],
    open_business_decisions: [],
    derivation_status: "ready",
    blockers: [],
    derivation_notes: [
      "Derived only from the approved onion snapshot.",
      "No LLM expansion or silent business guessing was used.",
    ],
    ...overrides,
  });
}

async function readJson<T>(projectRoot: string, relativePath: string): Promise<T> {
  const raw = await readFile(resolve(projectRoot, relativePath), "utf-8");
  return JSON.parse(raw) as T;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("handoff persists CTO admission artifacts and records pending-decision truth", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-pending-");
  const result = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/coo-freeze-to-cto-admission-wiring",
    requirementArtifact: buildRequirementArtifact(),
    finalizedRequirementMemoryId: BASE_MEMORY_ID,
    partition: "production",
    startedAtMs: Date.now() - 250,
  });

  assert.equal(result.state.status, "admission_pending_decision");
  assert.equal(result.state.outcome, "admitted");
  assert.equal(result.state.decision, null);
  assert.equal(result.state.partition, "production");
  assert.equal(
    result.state.artifact_paths.feature_root,
    "docs/phase1/coo-freeze-to-cto-admission-wiring",
  );
  assert.equal(
    result.state.artifact_paths.request_json,
    "docs/phase1/coo-freeze-to-cto-admission-wiring/cto-admission-request.json",
  );
  assert.equal(
    result.state.artifact_paths.decision_template_json,
    "docs/phase1/coo-freeze-to-cto-admission-wiring/cto-admission-decision.template.json",
  );
  assert.equal(
    result.state.artifact_paths.summary_md,
    "docs/phase1/coo-freeze-to-cto-admission-wiring/cto-admission-summary.md",
  );
  assert.equal(result.state.kpi.finalized_requirement_handoff_count, 1);
  assert.equal(result.state.kpi.admission_artifact_build_success_count, 1);
  assert.equal(result.state.kpi.admission_pending_decision_count, 1);
  assert.equal(result.state.kpi.requirement_to_admission_artifact_parity_count, 1);
  assert.equal(result.state.kpi.admission_status_write_completeness_rate, 1);
  assert.equal(result.receipts.filter((receipt) => receipt.kind === "cto_admission_artifact_persist").length, 3);

  const request = await readJson<Record<string, unknown>>(projectRoot, result.state.artifact_paths.request_json!);
  const decisionTemplate = await readJson<Record<string, unknown>>(
    projectRoot,
    result.state.artifact_paths.decision_template_json!,
  );
  const summary = await readFile(resolve(projectRoot, result.state.artifact_paths.summary_md!), "utf-8");

  assert.equal(request.feature_slug, "coo-freeze-to-cto-admission-wiring");
  assert.equal(request.partition, "production");
  assert.equal(
    request.requirement_artifact_source,
    `memory://finalized-requirement/${BASE_MEMORY_ID}`,
  );
  assert.equal(decisionTemplate.decision, null);
  assert.match(summary, /\*\*Decision:\*\* pending/);
});

test("handoff derives the feature root from scope path when the topic text differs", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-scope-slug-");
  const baseArtifact = buildRequirementArtifact();
  const result = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/coo-live-executive-status-wiring",
    requirementArtifact: buildRequirementArtifact({
      human_scope: {
        ...baseArtifact.human_scope,
        topic: "Live COO Executive Status Wiring",
      },
    }),
    finalizedRequirementMemoryId: BASE_MEMORY_ID,
    partition: "production",
  });

  assert.equal(result.state.feature_slug, "coo-live-executive-status-wiring");
  assert.equal(result.state.artifact_paths.feature_root, "docs/phase1/coo-live-executive-status-wiring");
  assert.equal(
    result.state.artifact_paths.request_json,
    "docs/phase1/coo-live-executive-status-wiring/cto-admission-request.json",
  );

  const request = await readJson<Record<string, unknown>>(projectRoot, result.state.artifact_paths.request_json!);
  assert.equal(request.feature_slug, "coo-live-executive-status-wiring");
});

test("handoff surfaces build_failed when the generated packet input is invalid", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-build-failed-");
  const result = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/coo-freeze-to-cto-admission-wiring",
    requirementArtifact: buildRequirementArtifact(),
    finalizedRequirementMemoryId: BASE_MEMORY_ID,
    builderInputOverrides: {
      claimed_scope_paths: [],
      requirement_summary: "",
    },
  });

  assert.equal(result.state.status, "admission_build_failed");
  assert.equal(result.state.outcome, "build_failed");
  assert.equal(result.state.artifact_paths.request_json, null);
  assert.equal(result.state.kpi.admission_artifact_build_failed_count, 1);
  assert.match(result.state.last_error ?? "", /claimed_scope_paths|required/i);
  assert.equal(result.receipts[0]?.kind, "cto_admission_build");
  assert.equal(result.receipts[0]?.success, false);
});

test("proof handoff fails closed on a real ADF checkout root", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-proof-root-");
  await writeFile(join(projectRoot, "AGENTS.md"), "# test\n", "utf-8");
  await mkdir(join(projectRoot, "COO"), { recursive: true });
  await writeFile(join(projectRoot, "COO", "package.json"), "{\n  \"name\": \"coo\"\n}\n", "utf-8");
  await mkdir(join(projectRoot, "components", "memory-engine"), { recursive: true });
  await writeFile(
    join(projectRoot, "components", "memory-engine", "package.json"),
    "{\n  \"name\": \"memory-engine\"\n}\n",
    "utf-8",
  );

  const result = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/coo-freeze-to-cto-admission-wiring",
    requirementArtifact: buildRequirementArtifact(),
    finalizedRequirementMemoryId: BASE_MEMORY_ID,
    partition: "proof",
  });

  assert.equal(result.state.status, "admission_build_failed");
  assert.equal(result.state.outcome, "admitted");
  assert.match(result.state.last_error ?? "", /isolated temp project root/i);
  assert.equal(result.state.artifact_paths.request_json, null);
  assert.equal(result.state.kpi.admission_artifact_persist_failure_count, 1);
  assert.equal(result.receipts.at(-1)?.action, "enforce_proof_root_isolation");
  assert.equal(
    await pathExists(resolve(projectRoot, "docs", "phase1", "coo-freeze-to-cto-admission-wiring", "cto-admission-request.json")),
    false,
  );
});

test("handoff counts artifact persist failures and does not fail silently", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-persist-failed-");
  await writeFile(
    join(projectRoot, "docs", "phase1", "coo-freeze-to-cto-admission-wiring"),
    "occupied-by-a-file",
    "utf-8",
  );

  const result = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/coo-freeze-to-cto-admission-wiring",
    requirementArtifact: buildRequirementArtifact(),
    finalizedRequirementMemoryId: BASE_MEMORY_ID,
  });

  assert.equal(result.state.status, "admission_build_failed");
  assert.equal(result.state.outcome, "admitted");
  assert.equal(result.state.kpi.admission_artifact_build_success_count, 1);
  assert.equal(result.state.kpi.admission_artifact_persist_failure_count, 1);
  assert.equal(result.state.kpi.requirement_to_admission_artifact_parity_count, 0);
  assert.match(result.state.last_error ?? "", /not a directory|EEXIST|ENOENT/i);
  assert.ok(result.receipts.some((receipt) => receipt.kind === "cto_admission_artifact_persist" && !receipt.success));
});

test("updateCtoAdmissionDecision persists an explicit admitted decision", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-admit-");
  const pending = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/coo-freeze-to-cto-admission-wiring",
    requirementArtifact: buildRequirementArtifact(),
    finalizedRequirementMemoryId: BASE_MEMORY_ID,
  });

  const updated = await updateCtoAdmissionDecision({
    projectRoot,
    state: pending.state,
    decision: "admit",
    decisionReason: "Capacity is available and the handoff packet is complete.",
    decidedBy: "cto-user",
  });

  assert.equal(updated.state.status, "admission_admitted");
  assert.equal(updated.state.decision, "admit");
  assert.equal(updated.state.kpi.admission_admitted_count, 1);
  assert.equal(updated.state.kpi.admission_status_write_completeness_rate, 1);
  const decisionTemplate = await readJson<Record<string, unknown>>(
    projectRoot,
    updated.state.artifact_paths.decision_template_json!,
  );
  const summary = await readFile(resolve(projectRoot, updated.state.artifact_paths.summary_md!), "utf-8");
  assert.equal(decisionTemplate.decision, "admit");
  assert.equal(decisionTemplate.decided_by, "cto-user");
  assert.match(summary, /\*\*Decision:\*\* admit/);
});

test("updateCtoAdmissionDecision persists an explicit deferred decision", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-defer-");
  const pending = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/coo-freeze-to-cto-admission-wiring",
    requirementArtifact: buildRequirementArtifact(),
    finalizedRequirementMemoryId: BASE_MEMORY_ID,
  });

  const updated = await updateCtoAdmissionDecision({
    projectRoot,
    state: pending.state,
    decision: "defer",
    decisionReason: "This work should wait until the upstream queue is cleared.",
    decidedBy: "cto-user",
  });

  assert.equal(updated.state.status, "admission_deferred");
  assert.equal(updated.state.decision, "defer");
  assert.equal(updated.state.kpi.admission_deferred_count, 1);
});

test("updateCtoAdmissionDecision persists an explicit blocked decision", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-block-");
  const pending = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/coo-freeze-to-cto-admission-wiring",
    requirementArtifact: buildRequirementArtifact(),
    finalizedRequirementMemoryId: BASE_MEMORY_ID,
  });

  const updated = await updateCtoAdmissionDecision({
    projectRoot,
    state: pending.state,
    decision: "block",
    decisionReason: "A hard dependency is still unresolved.",
    decidedBy: "cto-user",
  });

  assert.equal(updated.state.status, "admission_blocked");
  assert.equal(updated.state.decision, "block");
  assert.equal(updated.state.kpi.admission_blocked_count, 1);
});

test("handoff KPI tracks latency percentiles and keeps production and proof counts isolated", async () => {
  const projectRoot = await createProjectRoot("adf-cto-admission-live-kpi-");
  const requirementArtifact = buildRequirementArtifact({
    artifact_id: "artifact-live-admission-kpi-001",
    human_scope: {
      ...buildRequirementArtifact().human_scope,
      topic: "CTO Admission KPI Isolation Proof",
    },
  });

  const first = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/cto-admission-kpi-isolation-proof",
    requirementArtifact,
    finalizedRequirementMemoryId: "11111111-1111-4111-8111-111111111112",
    partition: "production",
    startedAtMs: Date.now() - 500,
  });
  const second = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/cto-admission-kpi-isolation-proof",
    requirementArtifact,
    finalizedRequirementMemoryId: "11111111-1111-4111-8111-111111111113",
    previousState: first.state,
    partition: "production",
    startedAtMs: Date.now() - 1_500,
  });
  const third = await handoffFinalizedRequirementToCtoAdmission({
    projectRoot,
    scopePath: "assafyavnai/adf/cto-admission-kpi-isolation-proof",
    requirementArtifact,
    finalizedRequirementMemoryId: "11111111-1111-4111-8111-111111111114",
    previousState: second.state,
    partition: "proof",
    startedAtMs: Date.now() - 65_000,
  });

  const latency = third.state.kpi.finalized_requirement_to_admission_latency_ms;
  assert.equal(third.state.kpi.finalized_requirement_handoff_count, 3);
  assert.equal(third.state.kpi.production_handoff_count, 2);
  assert.equal(third.state.kpi.proof_handoff_count, 1);
  assert.equal(latency.samples_ms.length, 3);
  assert.ok(latency.p50_ms >= 1_000);
  assert.ok(latency.p95_ms >= 60_000);
  assert.ok(latency.p99_ms >= latency.p95_ms);
  assert.equal(latency.over_1s_count, 2);
  assert.equal(latency.over_10s_count, 1);
  assert.equal(latency.over_60s_count, 1);
});
