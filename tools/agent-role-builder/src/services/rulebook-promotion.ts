import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSharedLearningEngineModule } from "./shared-module-loader.js";
import type { ResumePackage } from "./resume-state.js";
import { resolveResumeLearningArtifactPath } from "./resume-state.js";
import { stripUtf8Bom } from "./json-ingress.js";

type PromotionStatus =
  | "not_requested"
  | "no_learning_artifact"
  | "missing_learning_artifact"
  | "invalid_learning_artifact"
  | "no_new_rules"
  | "applied";

interface RulebookPromotionArtifact {
  schema_version: "1.0";
  component: "agent-role-builder";
  scope: "component_rulebook";
  status: PromotionStatus;
  source_rulebook_path: string;
  learning_artifact_path: string | null;
  promoted_rulebook_path: string | null;
  applied_rule_ids: string[];
  skipped_rule_ids: string[];
  details: string | null;
}

export async function applyFutureRunRulebookPromotion(params: {
  runDir: string;
  sourceRulebookPath: string;
  resumePackage: ResumePackage | null;
}): Promise<{
  effectiveRulebookPath: string;
  promotionArtifactPath: string | null;
}> {
  if (!params.resumePackage) {
    return {
      effectiveRulebookPath: params.sourceRulebookPath,
      promotionArtifactPath: null,
    };
  }

  const artifactPath = join(params.runDir, "runtime", "rulebook-promotion.json");
  const learningArtifactPath = await resolveResumeLearningArtifactPath(params.resumePackage);

  if (!learningArtifactPath) {
    await writePromotionArtifact(artifactPath, {
      schema_version: "1.0",
      component: "agent-role-builder",
      scope: "component_rulebook",
      status: "no_learning_artifact",
      source_rulebook_path: normalizePath(params.sourceRulebookPath),
      learning_artifact_path: null,
      promoted_rulebook_path: null,
      applied_rule_ids: [],
      skipped_rule_ids: [],
      details: "Resume package does not point to a prior learning artifact.",
    });
    return {
      effectiveRulebookPath: params.sourceRulebookPath,
      promotionArtifactPath: normalizePath(artifactPath),
    };
  }

  let parsedLearning: Awaited<ReturnType<Awaited<ReturnType<typeof loadSharedLearningEngineModule>>["parseLearningOutputJson"]>>;
  try {
    const learningEngine = await loadSharedLearningEngineModule();
    const learningRaw = await readFile(learningArtifactPath, "utf-8");
    parsedLearning = learningEngine.parseLearningOutputJson(learningRaw);
  } catch (error) {
    await writePromotionArtifact(artifactPath, {
      schema_version: "1.0",
      component: "agent-role-builder",
      scope: "component_rulebook",
      status: error instanceof Error && /ENOENT/i.test(error.message)
        ? "missing_learning_artifact"
        : "invalid_learning_artifact",
      source_rulebook_path: normalizePath(params.sourceRulebookPath),
      learning_artifact_path: normalizePath(learningArtifactPath),
      promoted_rulebook_path: null,
      applied_rule_ids: [],
      skipped_rule_ids: [],
      details: error instanceof Error ? error.message : String(error),
    });
    return {
      effectiveRulebookPath: params.sourceRulebookPath,
      promotionArtifactPath: normalizePath(artifactPath),
    };
  }

  const sourceRulebook = JSON.parse(stripUtf8Bom(await readFile(params.sourceRulebookPath, "utf-8"))) as {
    rules: Array<{ id: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };
  const existingRuleIds = new Set(sourceRulebook.rules.map((rule) => rule.id));
  const learningEngine = await loadSharedLearningEngineModule();
  const mergedRules = learningEngine.applyProposedRules(sourceRulebook.rules, parsedLearning.new_rules);
  const appliedRuleIds = parsedLearning.new_rules
    .map((rule: { id: string }) => rule.id)
    .filter((ruleId: string) => !existingRuleIds.has(ruleId));
  const skippedRuleIds = parsedLearning.new_rules
    .map((rule: { id: string }) => rule.id)
    .filter((ruleId: string) => existingRuleIds.has(ruleId));

  if (appliedRuleIds.length === 0) {
    await writePromotionArtifact(artifactPath, {
      schema_version: "1.0",
      component: "agent-role-builder",
      scope: "component_rulebook",
      status: "no_new_rules",
      source_rulebook_path: normalizePath(params.sourceRulebookPath),
      learning_artifact_path: normalizePath(learningArtifactPath),
      promoted_rulebook_path: null,
      applied_rule_ids: [],
      skipped_rule_ids: skippedRuleIds,
      details: "Learning artifact did not add any new rule IDs beyond the governed source rulebook.",
    });
    return {
      effectiveRulebookPath: params.sourceRulebookPath,
      promotionArtifactPath: normalizePath(artifactPath),
    };
  }

  const promotedRulebookPath = join(params.runDir, "runtime", "promoted-rulebook.json");
  const promotedRulebook = {
    ...sourceRulebook,
    rules: mergedRules,
    new_rule_ids: appliedRuleIds,
  };
  await writeFile(promotedRulebookPath, JSON.stringify(promotedRulebook, null, 2), "utf-8");
  await writePromotionArtifact(artifactPath, {
    schema_version: "1.0",
    component: "agent-role-builder",
    scope: "component_rulebook",
    status: "applied",
    source_rulebook_path: normalizePath(params.sourceRulebookPath),
    learning_artifact_path: normalizePath(learningArtifactPath),
    promoted_rulebook_path: normalizePath(promotedRulebookPath),
    applied_rule_ids: appliedRuleIds,
    skipped_rule_ids: skippedRuleIds,
    details: `Applied ${appliedRuleIds.length} future-run rule proposal(s) from the prior learning artifact.`,
  });

  return {
    effectiveRulebookPath: promotedRulebookPath,
    promotionArtifactPath: normalizePath(artifactPath),
  };
}

async function writePromotionArtifact(path: string, artifact: RulebookPromotionArtifact): Promise<void> {
  await writeFile(path, JSON.stringify(artifact, null, 2), "utf-8");
}

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/");
}
