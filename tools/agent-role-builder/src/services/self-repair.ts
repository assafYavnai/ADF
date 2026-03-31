import { emit, createSystemProvenance } from "../shared-imports.js";
import type { InvocationParams, InvocationResult } from "../shared-imports.js";
import { loadSelfRepairEngineModule } from "./shared-module-loader.js";

export async function repairSupplementalSessionRegistry(params: {
  request: { job_id: string };
  runDir: string;
  sourceSessionRegistryPath: string;
  repairedSessionRegistryPath: string;
  message: string;
  incidentType: "invalid_runtime_artifact" | "missing_runtime_artifact";
  details?: Record<string, unknown>;
  replacementText: string;
}): Promise<{
  result: Awaited<ReturnType<Awaited<ReturnType<typeof loadSelfRepairEngineModule>>["repairRuntimeArtifact"]>>;
}> {
  const repairEngine = await loadSelfRepairEngineModule();
  const startedAt = Date.now();
  try {
    const result = await repairEngine.repairRuntimeArtifact({
      component: "agent-role-builder",
      requestJobId: params.request.job_id,
      runDir: params.runDir,
      engine: "startup",
      incidentType: params.incidentType,
      message: params.message,
      targetPath: params.repairedSessionRegistryPath,
      replacementText: params.replacementText,
      details: {
        ...(params.details ?? {}),
        source_session_registry_path: params.sourceSessionRegistryPath,
      },
    });
    emit({
      provenance: createSystemProvenance("tools/agent-role-builder/self-repair"),
      category: "tool",
      operation: "self-repair-engine",
      latency_ms: Date.now() - startedAt,
      success: true,
      metadata: {
        engine: "self-repair-engine",
        stage: "repair-supplemental-session-registry",
        incident_type: params.incidentType,
        action: result.action,
        status: result.status,
      },
    });
    return { result };
  } catch (error) {
    emit({
      provenance: createSystemProvenance("tools/agent-role-builder/self-repair"),
      category: "tool",
      operation: "self-repair-engine",
      latency_ms: Date.now() - startedAt,
      success: false,
      metadata: {
        engine: "self-repair-engine",
        stage: "repair-supplemental-session-registry",
        incident_type: params.incidentType,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export async function invokeWithSelfRepair(params: {
  request: { job_id: string };
  runDir: string | null;
  engine: "board-review" | "parse-auto-fix" | "self-learning-engine" | "rules-compliance-enforcer";
  message: string;
  provider: "codex" | "claude" | "gemini";
  model: string;
  sourcePath: string;
  round?: number | null;
  slotKey?: string | null;
  primary: () => Promise<InvocationResult>;
  buildColdStartParams: () => InvocationParams;
}): Promise<InvocationResult> {
  if (!params.runDir) {
    return params.primary();
  }

  const repairEngine = await loadSelfRepairEngineModule();
  const startedAt = Date.now();
  try {
    const outcome = await repairEngine.invokeWithSelfRepair({
      component: "agent-role-builder",
      requestJobId: params.request.job_id,
      runDir: params.runDir,
      engine: params.engine,
      message: params.message,
      provider: params.provider,
      model: params.model,
      round: params.round ?? null,
      slotKey: params.slotKey ?? null,
      details: {
        source_path: params.sourcePath,
      },
      primary: params.primary,
      repair: async () => {
        const { invoke } = await import("../shared-imports.js");
        return invoke(params.buildColdStartParams());
      },
    });
    if (outcome.repair) {
      emit({
        provenance: createSystemProvenance("tools/agent-role-builder/self-repair"),
        category: "tool",
        operation: "self-repair-engine",
        latency_ms: Date.now() - startedAt,
        success: true,
        metadata: {
          engine: "self-repair-engine",
          stage: params.engine,
          incident_type: "provider_cli_failure",
          action: outcome.repair.action,
          status: outcome.repair.status,
          provider: params.provider,
          model: params.model,
          round: params.round ?? null,
          slot_key: params.slotKey ?? null,
        },
      });
    }
    return outcome.value;
  } catch (error) {
    emit({
      provenance: createSystemProvenance("tools/agent-role-builder/self-repair"),
      category: "tool",
      operation: "self-repair-engine",
      latency_ms: Date.now() - startedAt,
      success: false,
      metadata: {
        engine: "self-repair-engine",
        stage: params.engine,
        incident_type: "provider_cli_failure",
        provider: params.provider,
        model: params.model,
        round: params.round ?? null,
        slot_key: params.slotKey ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
