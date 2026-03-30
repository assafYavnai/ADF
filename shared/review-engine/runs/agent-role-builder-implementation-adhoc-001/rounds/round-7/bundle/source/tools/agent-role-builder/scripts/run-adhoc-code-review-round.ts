import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { performance } from "node:perf_hooks";
import { buildReviewerPrompt, parseReviewerOutput } from "../../../shared/review-engine/engine.js";
import { loadReviewRuntimeConfig, resolveReviewMode } from "../../../shared/review-engine/config.js";
import type { ReviewRoundSummary, ReviewVerdictShape } from "../../../shared/review-engine/types.js";
import { ComplianceMap as ComplianceMapSchema } from "../../../shared/learning-engine/compliance-map.js";
import { extractRules } from "../../../shared/learning-engine/engine.js";
import { FixItemsMap as FixItemsMapSchema } from "../../../shared/learning-engine/fix-items-map.js";
import type { LearningInput, ReviewFinding } from "../../../shared/learning-engine/types.js";
import { invoke } from "../src/shared-imports.js";

const CODE_REVIEW_COMPONENT_ROOT = join("shared", "review-engine", "code-review");
const RULEBOOK_PATH = join("shared", "learning-engine", "implementor-rulebook.json");
const SHARED_REVIEW_CONTRACT_PATH = join("shared", "learning-engine", "review-contract.json");
const CODE_REVIEW_CONTRACT_PATH = join("shared", "learning-engine", "code-review-contract.json");
const AUTHORITY_PATHS = [
  join("docs", "v0", "review-process-architecture.md"),
  join("docs", "v0", "architecture.md"),
  join("docs", "v0", "context", "step2g-efficiency-plan.md"),
  SHARED_REVIEW_CONTRACT_PATH,
  CODE_REVIEW_CONTRACT_PATH,
  RULEBOOK_PATH,
];

const TARGET_FILES = [
  join("shared", "review-engine", "config.ts"),
  join("shared", "review-engine", "engine.ts"),
  join("shared", "review-engine", "types.ts"),
  join("shared", "component-repair-engine", "engine.ts"),
  join("shared", "component-repair-engine", "types.ts"),
  join("shared", "learning-engine", "engine.ts"),
  join("shared", "learning-engine", "types.ts"),
  join("shared", "learning-engine", "review-contract.json"),
  join("shared", "learning-engine", "code-review-contract.json"),
  join("shared", "learning-engine", "implementor-rulebook.json"),
  join("tools", "agent-role-builder", "review-prompt.json"),
  join("tools", "agent-role-builder", "review-contract.json"),
  join("tools", "agent-role-builder", "rulebook.json"),
  join("tools", "agent-role-builder", "scripts", "run-adhoc-code-review-round.ts"),
  join("tools", "agent-role-builder", "src", "index.ts"),
  join("tools", "agent-role-builder", "src", "schemas", "result.ts"),
  join("tools", "agent-role-builder", "src", "shared-imports.ts"),
  join("tools", "agent-role-builder", "src", "services", "audit-utils.ts"),
  join("tools", "agent-role-builder", "src", "services", "board.ts"),
  join("tools", "agent-role-builder", "src", "services", "role-generator.ts"),
  join("tools", "agent-role-builder", "src", "services", "shared-module-loader.ts"),
  join("tools", "agent-role-builder", "src", "services", "validator.ts"),
];

interface ReviewerRunResult {
  reviewerId: string;
  provider: "codex" | "claude";
  model: string;
  rawPath: string;
  parsedPath: string;
  verdict: ReviewVerdictShape;
  latencyMs: number;
  wasFallback: boolean;
}

async function main() {
  const runDir = process.argv[2];
  const roundArg = process.argv[3];
  if (!runDir || roundArg === undefined) {
    throw new Error("Usage: run-adhoc-code-review-round <run-dir> <round-number>");
  }

  const round = Number.parseInt(roundArg, 10);
  if (!Number.isInteger(round) || round < 0) {
    throw new Error(`Invalid round number: ${roundArg}`);
  }

  const roundDir = join(runDir, "rounds", `round-${round}`);
  const bundleDir = join(roundDir, "bundle");
  const sourceDir = join(bundleDir, "source");
  const authorityDir = join(bundleDir, "authority");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(authorityDir, { recursive: true });

  const reviewConfig = await loadReviewRuntimeConfig(CODE_REVIEW_COMPONENT_ROOT);
  const priorRounds = await loadPriorRoundSummaries(runDir, round);
  const reviewMode = resolveReviewMode(round, false, reviewConfig);

  const priorFindingsPath = await copyOptionalPriorArtifact(runDir, round, "merged-findings.json", join(bundleDir, "findings.json"));
  const priorCompliancePath = await copyOptionalPriorArtifact(runDir, round, "compliance-map.json", join(bundleDir, "compliance-map.json"));
  const priorFixItemsPath = await copyOptionalPriorArtifact(runDir, round, "fix-items-map.json", join(bundleDir, "fix-items-map.json"));
  const priorDiffSummaryPath = await copyOptionalPriorArtifact(runDir, round, "diff-summary.json", join(bundleDir, "diff-summary.json"));
  const priorLearningPath = await copyOptionalPriorArtifact(runDir, round, "learning.json", join(bundleDir, "learning.json"));

  const complianceRequired = reviewConfig.componentPrompt.compliance_map_required === true;
  if (complianceRequired && !priorCompliancePath) {
    throw new Error(`Missing required implementer evidence for round ${round}: prior compliance-map.json.`);
  }
  if (priorCompliancePath) {
    await validateComplianceMapArtifact(priorCompliancePath);
  }
  if (priorFixItemsPath) {
    await validateFixItemsArtifact(priorFixItemsPath);
  }
  if (priorDiffSummaryPath) {
    await validateDiffSummaryArtifact(priorDiffSummaryPath);
  }

  const evidenceSourcePaths = await collectEvidenceSourcePaths({
    priorCompliancePath,
    priorFixItemsPath,
    priorDiffSummaryPath,
  });
  const copiedSources = await Promise.all(uniquePaths([...TARGET_FILES, ...evidenceSourcePaths]).map((filePath) => copyIntoBundle(filePath, sourceDir)));
  const copiedAuthorities = await Promise.all(AUTHORITY_PATHS.map((filePath) => copyIntoBundle(filePath, authorityDir)));
  const componentPromptPath = await copyFlatFile(join(CODE_REVIEW_COMPONENT_ROOT, "review-prompt.json"), bundleDir);
  const componentContractPath = await copyFlatFile(join(CODE_REVIEW_COMPONENT_ROOT, "review-contract.json"), bundleDir);

  const manifestPath = join(bundleDir, "source-manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    schema_version: "1.0",
    run_dir: normalize(runDir),
    round,
    review_mode: reviewMode,
    component_root: normalize(CODE_REVIEW_COMPONENT_ROOT),
    source_files: copiedSources.map(normalize),
    authority_files: copiedAuthorities.map(normalize),
    component_review_prompt: normalize(componentPromptPath),
    component_review_contract: normalize(componentContractPath),
    prior_findings: priorFindingsPath ? normalize(priorFindingsPath) : null,
    prior_compliance_map: priorCompliancePath ? normalize(priorCompliancePath) : null,
    prior_fix_items_map: priorFixItemsPath ? normalize(priorFixItemsPath) : null,
    prior_diff_summary: priorDiffSummaryPath ? normalize(priorDiffSummaryPath) : null,
    prior_learning: priorLearningPath ? normalize(priorLearningPath) : null,
  }, null, 2), "utf-8");

  const reviewPackagePath = join(bundleDir, "review-package.md");
  await writeFile(reviewPackagePath, buildReviewPackage({
    round,
    reviewMode,
    manifestPath,
    sourceFiles: copiedSources,
    authorityFiles: copiedAuthorities,
    priorFindingsPath,
    priorCompliancePath,
    priorFixItemsPath,
    priorDiffSummaryPath,
    priorLearningPath,
  }), "utf-8");

  const priorFindings = priorFindingsPath ? await readText(priorFindingsPath) : "";
  const priorCompliance = priorCompliancePath ? await readText(priorCompliancePath) : "";
  const priorFixItems = priorFixItemsPath ? await readText(priorFixItemsPath) : "";
  const priorDiffSummary = priorDiffSummaryPath ? await readText(priorDiffSummaryPath) : "";
  const priorLearning = priorLearningPath ? await readText(priorLearningPath) : "";

  const contractSummary = [
    JSON.stringify({
      ad_hoc_review: true,
      scope: "Review the implementation bundle covering shared review components and agent-role-builder runtime code.",
      round,
      target_file_count: copiedSources.length,
      review_manifest: normalize(manifestPath),
      prior_findings_file: priorFindingsPath ? normalize(priorFindingsPath) : null,
      prior_compliance_map: priorCompliancePath ? normalize(priorCompliancePath) : null,
      prior_fix_items_map: priorFixItemsPath ? normalize(priorFixItemsPath) : null,
      prior_diff_summary: priorDiffSummaryPath ? normalize(priorDiffSummaryPath) : null,
      prior_learning: priorLearningPath ? normalize(priorLearningPath) : null,
    }, null, 2),
    priorFindings ? `\nPrior merged findings:\n${truncate(priorFindings, 5000)}` : "",
    priorDiffSummary ? `\nPrior diff summary:\n${truncate(priorDiffSummary, 5000)}` : "",
    priorLearning ? `\nPrior learning:\n${truncate(priorLearning, 5000)}` : "",
  ].join("");

  const fixItemsContext = priorFixItems
    ? `\n\nPrior implementer fix items map:\n${truncate(priorFixItems, 5000)}`
    : "";
  const complianceContext = priorCompliance
    ? `\n\nPrior implementer compliance map:\n${truncate(priorCompliance, 5000)}`
    : "";

  const reviewerPrompt = buildReviewerPrompt({
    componentName: "ADF Code Review (ad-hoc)",
    artifactLabel: "implementation bundle manifest",
    round,
    reviewMode,
    artifactPath: normalize(reviewPackagePath),
    contractSummary,
    selfCheckContext: "\n\nSelf-check context: external ad-hoc review; no automatic self-check artifact provided.",
    complianceContext,
    fixItemsContext,
    priorRounds,
    config: reviewConfig,
  });

  const requireFixDecisions = Boolean(priorFixItemsPath)
    && round >= (reviewConfig.componentPrompt.fix_items_map_required_from_round ?? 1);
  const reviewerResults = await runReviewers(roundDir, reviewerPrompt, requireFixDecisions, reviewConfig);
  const mergedFindings = mergeFindings(reviewerResults);
  await writeFile(join(roundDir, "merged-findings.json"), JSON.stringify(mergedFindings, null, 2), "utf-8");

  const learningInput = await buildLearningInput(round, mergedFindings);
  const learningStart = performance.now();
  const learningOutput = await extractRules(
    learningInput,
    async (prompt, sourcePath) => {
      const response = await invoke({
        cli: "codex",
        model: "gpt-5.4",
        reasoning: "high",
        bypass: false,
        timeout_ms: 900_000,
        prompt,
        source_path: sourcePath,
      });
      return response.response;
    }
  );
  const learningLatencyMs = Math.round(performance.now() - learningStart);
  await writeFile(join(roundDir, "learning.json"), JSON.stringify(learningOutput, null, 2), "utf-8");

  const unresolvedItems = mergedFindings
    .filter((finding) => finding.severity === "blocking" || finding.severity === "major")
    .map((finding) => `${finding.group_id}: ${finding.summary}`);
  const improvementsApplied = priorFixItems
    ? FixItemsMapSchema.parse(JSON.parse(priorFixItems)).items
      .filter((item) => item.action === "accepted")
      .map((item) => item.summary)
    : [];
  const reviewOutcome = reviewerResults.every((result) => result.verdict.verdict === "approved")
    ? "approved"
    : reviewerResults.some((result) => result.verdict.verdict === "reject")
      ? "pushback"
      : "conditional";

  const roundSummary = {
    round,
    review_mode: reviewMode,
    review_outcome: reviewOutcome,
    unresolved_items: unresolvedItems,
    improvements_applied: improvementsApplied,
    reviewers: reviewerResults.map((result) => ({
      reviewer_id: result.reviewerId,
      provider: result.provider,
      model: result.model,
      latency_ms: result.latencyMs,
      was_fallback: result.wasFallback,
      verdict: result.verdict.verdict,
      severity_counts: countSeverities(result.verdict),
      raw_path: normalize(result.rawPath),
      parsed_path: normalize(result.parsedPath),
    })),
    merged_findings_path: normalize(join(roundDir, "merged-findings.json")),
    learning_path: normalize(join(roundDir, "learning.json")),
    totals: {
      blocking: mergedFindings.filter((finding) => finding.severity === "blocking").length,
      major: mergedFindings.filter((finding) => finding.severity === "major").length,
      minor: mergedFindings.filter((finding) => finding.severity === "minor").length,
      suggestion: mergedFindings.filter((finding) => finding.severity === "suggestion").length,
    },
    learning: {
      new_rules: learningOutput.new_rules.length,
      existing_rules_covering: learningOutput.existing_rules_covering.length,
      no_rule_needed: learningOutput.no_rule_needed.length,
      latency_ms: learningLatencyMs,
    },
  };
  await writeFile(join(roundDir, "round-summary.json"), JSON.stringify(roundSummary, null, 2), "utf-8");

  await updateRunKpi(runDir, roundSummary);
  console.log(JSON.stringify({
    round,
    review_mode: reviewMode,
    merged_findings: mergedFindings.length,
    new_rules: learningOutput.new_rules.length,
    reviewer_verdicts: reviewerResults.map((result) => ({
      reviewer_id: result.reviewerId,
      verdict: result.verdict.verdict,
      latency_ms: result.latencyMs,
    })),
  }, null, 2));
}

async function runReviewers(
  roundDir: string,
  prompt: string,
  requireFixDecisions: boolean,
  reviewConfig: Awaited<ReturnType<typeof loadReviewRuntimeConfig>>
): Promise<ReviewerRunResult[]> {
  const reviewers = [
    { reviewerId: "reviewer-codex", provider: "codex" as const, model: "gpt-5.4", reasoning: "high" as const },
    { reviewerId: "reviewer-claude", provider: "claude" as const, model: "sonnet", effort: "high" as const },
  ];

  const results = await Promise.all(reviewers.map(async (reviewer) => {
    const started = performance.now();
    const response = await invoke({
      cli: reviewer.provider,
      model: reviewer.model,
      reasoning: "reasoning" in reviewer ? reviewer.reasoning : undefined,
      effort: "effort" in reviewer ? reviewer.effort : undefined,
      bypass: false,
      timeout_ms: 900_000,
      prompt,
      source_path: `shared/review-engine/code-review/${reviewer.reviewerId}`,
    });
    const rawPath = join(roundDir, `${reviewer.reviewerId}.raw.txt`);
    const parsedPath = join(roundDir, `${reviewer.reviewerId}.parsed.json`);
    await writeFile(rawPath, response.response, "utf-8");

    const verdict = parseReviewerOutput(response.response, { requireFixDecisions, config: reviewConfig });
    await writeFile(parsedPath, JSON.stringify(verdict, null, 2), "utf-8");

    return {
      reviewerId: reviewer.reviewerId,
      provider: reviewer.provider,
      model: reviewer.model,
      rawPath,
      parsedPath,
      verdict,
      latencyMs: Math.round(performance.now() - started),
      wasFallback: response.provenance.was_fallback,
    };
  }));

  return results;
}

function mergeFindings(reviewerResults: ReviewerRunResult[]): ReviewFinding[] {
  const merged: ReviewFinding[] = [];
  for (const reviewer of reviewerResults) {
    for (const group of reviewer.verdict.conceptual_groups) {
      merged.push({
        group_id: `${reviewer.reviewerId}:${group.id}`,
        summary: group.summary,
        severity: group.severity,
        redesign_guidance: group.redesign_guidance,
        finding_count: Array.isArray(group.findings) ? group.findings.length : 0,
      });
    }
  }
  return merged;
}

async function buildLearningInput(round: number, mergedFindings: ReviewFinding[]): Promise<LearningInput> {
  const rawRulebook = JSON.parse(await readFile(RULEBOOK_PATH, "utf-8")) as { rules?: LearningInput["current_rulebook"] };
  return {
    component: "code-review",
    round,
    review_findings: mergedFindings,
    current_rulebook: rawRulebook.rules ?? [],
    review_prompt_domain: "code",
    review_prompt_path: join(CODE_REVIEW_COMPONENT_ROOT, "review-prompt.json"),
    review_contract_path: join(CODE_REVIEW_COMPONENT_ROOT, "review-contract.json"),
    unresolved_from_leader: mergedFindings
      .filter((finding) => finding.severity === "blocking" || finding.severity === "major")
      .map((finding) => `${finding.group_id}: ${finding.summary}`),
  };
}

async function loadPriorRoundSummaries(runDir: string, currentRound: number): Promise<ReviewRoundSummary[]> {
  const summaries: ReviewRoundSummary[] = [];
  for (let round = 0; round < currentRound; round++) {
    const summaryPath = join(runDir, "rounds", `round-${round}`, "round-summary.json");
    try {
      const parsed = JSON.parse(await readFile(summaryPath, "utf-8")) as {
        round: number;
        review_mode: "full" | "delta" | "regression_sanity";
        review_outcome?: string;
        unresolved_items?: string[];
        improvements_applied?: string[];
        totals?: { blocking: number; major: number };
      };
      summaries.push({
        round: parsed.round,
        reviewMode: parsed.review_mode,
        leaderVerdict: parsed.review_outcome ?? ((parsed.totals?.blocking ?? 0) > 0 || (parsed.totals?.major ?? 0) > 0 ? "pushback" : "approved"),
        unresolved: Array.isArray(parsed.unresolved_items) ? parsed.unresolved_items : [],
        improvementsApplied: Array.isArray(parsed.improvements_applied) ? parsed.improvements_applied : [],
      });
    } catch {
      continue;
    }
  }
  return summaries;
}

async function updateRunKpi(runDir: string, roundSummary: Record<string, unknown>): Promise<void> {
  const kpiPath = join(runDir, "kpi.json");
  let existing: { rounds: unknown[] } = { rounds: [] };
  try {
    existing = JSON.parse(await readFile(kpiPath, "utf-8")) as { rounds: unknown[] };
  } catch {
    existing = { rounds: [] };
  }

  const updated = {
    schema_version: "1.0",
    component: "shared-review-engine-code-review",
    generated_at: new Date().toISOString(),
    rounds: [
      ...existing.rounds.filter((item) => {
        const round = typeof item === "object" && item && "round" in item ? Number((item as { round: number }).round) : -1;
        return round !== Number((roundSummary as { round: number }).round);
      }),
      roundSummary,
    ].sort((a, b) => Number((a as { round: number }).round) - Number((b as { round: number }).round)),
  };

  await writeFile(kpiPath, JSON.stringify(updated, null, 2), "utf-8");
}

async function copyIntoBundle(sourcePath: string, rootDestination: string): Promise<string> {
  const destination = join(rootDestination, sourcePath);
  await mkdir(dirname(destination), { recursive: true });
  const content = await readFile(sourcePath, "utf-8");
  await writeFile(destination, content, "utf-8");
  return destination;
}

async function copyFlatFile(sourcePath: string, destinationDir: string): Promise<string> {
  const destination = join(destinationDir, sourcePath.split(/[\\/]/).pop() ?? sourcePath);
  const content = await readFile(sourcePath, "utf-8");
  await writeFile(destination, content, "utf-8");
  return destination;
}

async function copyOptionalPriorArtifact(runDir: string, round: number, artifactName: string, destination: string): Promise<string | null> {
  if (round === 0) return null;
  const source = join(runDir, "rounds", `round-${round - 1}`, artifactName);
  try {
    const content = await readFile(source, "utf-8");
    await writeFile(destination, content, "utf-8");
    return destination;
  } catch {
    return null;
  }
}

function buildReviewPackage(params: {
  round: number;
  reviewMode: "full" | "delta" | "regression_sanity";
  manifestPath: string;
  sourceFiles: string[];
  authorityFiles: string[];
  priorFindingsPath: string | null;
  priorCompliancePath: string | null;
  priorFixItemsPath: string | null;
  priorDiffSummaryPath: string | null;
  priorLearningPath: string | null;
}): string {
  const relativeSources = params.sourceFiles.map((filePath) => `- ${normalize(filePath)}`).join("\n");
  const relativeAuthorities = params.authorityFiles.map((filePath) => `- ${normalize(filePath)}`).join("\n");
  return [
    "# Ad-Hoc Code Review Package",
    "",
    `Round: ${params.round}`,
    `Mode: ${params.reviewMode}`,
    "",
    "Read the manifest first. Then read only the files copied into this bundle.",
    "",
    `Manifest: ${normalize(params.manifestPath)}`,
    "",
    "Target source files:",
    relativeSources,
    "",
    "Authority files:",
    relativeAuthorities,
    "",
    `Prior findings: ${params.priorFindingsPath ? normalize(params.priorFindingsPath) : "(none)"}`,
    `Prior compliance map: ${params.priorCompliancePath ? normalize(params.priorCompliancePath) : "(none)"}`,
    `Prior fix items map: ${params.priorFixItemsPath ? normalize(params.priorFixItemsPath) : "(none)"}`,
    `Prior diff summary: ${params.priorDiffSummaryPath ? normalize(params.priorDiffSummaryPath) : "(none)"}`,
    `Prior learning: ${params.priorLearningPath ? normalize(params.priorLearningPath) : "(none)"}`,
    "",
    "Instructions:",
    "- Review the shared review/runtime modules and the agent-role-builder implementation together as one governed implementation surface.",
    "- Stay boxed to this bundle.",
    "- Focus on correctness, review-cycle sequencing, schema/runtime alignment, audit/KPI integrity, and mirrored-module drift.",
    "- Return JSON only, matching the shared review contract.",
  ].join("\n");
}

function countSeverities(verdict: ReviewVerdictShape) {
  return verdict.conceptual_groups.reduce(
    (counts, group) => {
      counts[group.severity]++;
      return counts;
    },
    { blocking: 0, major: 0, minor: 0, suggestion: 0 }
  );
}

function normalize(pathValue: string): string {
  return pathValue.replace(/\\/g, "/");
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length)}\n...<truncated>`;
}

async function readText(pathValue: string): Promise<string> {
  return readFile(pathValue, "utf-8");
}

async function collectEvidenceSourcePaths(params: {
  priorCompliancePath: string | null;
  priorFixItemsPath: string | null;
  priorDiffSummaryPath: string | null;
}): Promise<string[]> {
  const paths: string[] = [];

  if (params.priorCompliancePath) {
    const parsed = ComplianceMapSchema.parse(JSON.parse(await readFile(params.priorCompliancePath, "utf-8")));
    for (const entry of parsed.entries) {
      paths.push(...extractReferencedPaths(entry.evidence_location));
    }
  }

  if (params.priorFixItemsPath) {
    const parsed = FixItemsMapSchema.parse(JSON.parse(await readFile(params.priorFixItemsPath, "utf-8")));
    for (const item of parsed.items) {
      if (item.evidence_location) {
        paths.push(...extractReferencedPaths(item.evidence_location));
      }
    }
  }

  if (params.priorDiffSummaryPath) {
    const parsed = JSON.parse(await readFile(params.priorDiffSummaryPath, "utf-8")) as { implementation_scope?: unknown };
    if (Array.isArray(parsed.implementation_scope)) {
      for (const value of parsed.implementation_scope) {
        if (typeof value === "string") {
          paths.push(...extractReferencedPaths(value));
        }
      }
    }
  }

  return uniquePaths(paths);
}

function extractReferencedPaths(value: string): string[] {
  return value
    .split(";")
    .map((part) => normalizeReferencedPath(part))
    .filter((part): part is string => Boolean(part));
}

function uniquePaths(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeReferencedPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\\/g, "/");
  const cwdPrefix = normalize(process.cwd());
  const repoRelative = normalized.toLowerCase().startsWith(`${cwdPrefix.toLowerCase()}/`)
    ? normalized.slice(cwdPrefix.length + 1)
    : normalized.replace(/^[A-Za-z]:\//, "");

  if (/^(shared|tools|docs)\//.test(repoRelative)) {
    return repoRelative;
  }

  throw new Error(`Referenced evidence path is not boxable: ${trimmed}`);
}

async function validateComplianceMapArtifact(pathValue: string): Promise<void> {
  const parsed = JSON.parse(await readFile(pathValue, "utf-8"));
  ComplianceMapSchema.parse(parsed);
}

async function validateFixItemsArtifact(pathValue: string): Promise<void> {
  const parsed = JSON.parse(await readFile(pathValue, "utf-8"));
  FixItemsMapSchema.parse(parsed);
}

async function validateDiffSummaryArtifact(pathValue: string): Promise<void> {
  const parsed = JSON.parse(await readFile(pathValue, "utf-8")) as {
    changed?: unknown;
    summary?: unknown;
    generated_at?: unknown;
  };
  if (typeof parsed.changed !== "boolean") {
    throw new Error(`Invalid diff-summary artifact ${pathValue}: changed must be a boolean.`);
  }
  if (typeof parsed.summary !== "string" || parsed.summary.trim().length === 0) {
    throw new Error(`Invalid diff-summary artifact ${pathValue}: summary must be a non-empty string.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
