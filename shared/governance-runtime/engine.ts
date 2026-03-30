import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseJsonTextWithBomSupport } from "../json-ingress.js";
import { loadReviewRuntimeConfigFromPaths } from "../review-engine/config.js";
import type {
  GovernanceBinding,
  GovernanceFault,
  GovernanceIncident,
  GovernanceSnapshot,
  PilotAuthorityInputPaths,
  PilotBoardRoster,
  PilotGovernanceContext,
  PilotGovernanceContextInput,
  PilotRosterBootstrap,
  TerminalLegalityDecision,
  TerminalLegalityInput,
} from "./types.js";

const FROZEN_REVIEWER_PAIR_HINTS = ["codex reviewer", "claude reviewer"];

export async function loadPilotRosterBootstrap(sharedContractPath = join("shared", "learning-engine", "review-contract.json")): Promise<PilotRosterBootstrap> {
  const sharedContract = await readJsonRequired<Record<string, unknown>>(sharedContractPath, "shared review contract");
  const rosterRequirements = asRecord(sharedContract.roster_requirements, "shared_contract.roster_requirements");
  const minimumReviewerCount = asNumber(rosterRequirements.minimum_reviewer_count, "shared_contract.roster_requirements.minimum_reviewer_count");
  const reviewerCountMustBeEven = asBoolean(rosterRequirements.reviewer_count_must_be_even, "shared_contract.roster_requirements.reviewer_count_must_be_even");
  const requiredPairShape = asString(rosterRequirements.required_pair_shape, "shared_contract.roster_requirements.required_pair_shape");
  const validationPhase = asString(rosterRequirements.validation_phase, "shared_contract.roster_requirements.validation_phase");
  const failClosed = asBoolean(rosterRequirements.fail_closed, "shared_contract.roster_requirements.fail_closed");

  const requiredPairShapeLower = requiredPairShape.toLowerCase();
  if (!FROZEN_REVIEWER_PAIR_HINTS.every((hint) => requiredPairShapeLower.includes(hint))) {
    throw new Error(
      "[governance-runtime] Unsupported shared-contract roster pair shape for the frozen V1 pilot. " +
      "The current contract-version adapter expects one Codex reviewer and one Claude reviewer per adjacent pair."
    );
  }

  return {
    shared_contract_path: normalizePath(sharedContractPath),
    minimum_reviewer_count: minimumReviewerCount,
    reviewer_count_must_be_even: reviewerCountMustBeEven,
    required_pair_shape: requiredPairShape,
    validation_phase: validationPhase,
    fail_closed: failClosed,
  };
}

export function validatePilotRoster(boardRoster: PilotBoardRoster, bootstrap: PilotRosterBootstrap): GovernanceFault[] {
  const faults: GovernanceFault[] = [];
  const reviewers = Array.isArray(boardRoster.reviewers) ? boardRoster.reviewers : [];

  if (bootstrap.validation_phase !== "request_validation") {
    faults.push({
      code: "UNSUPPORTED_ROSTER_VALIDATION_PHASE",
      message: `Frozen V1 expects roster validation_phase=request_validation, got ${bootstrap.validation_phase}.`,
    });
    return faults;
  }

  if (reviewers.length !== boardRoster.reviewer_count) {
    faults.push({
      code: "ROSTER_MISMATCH",
      message: `reviewer_count (${boardRoster.reviewer_count}) does not match reviewers array length (${reviewers.length})`,
    });
  }

  if (reviewers.length < bootstrap.minimum_reviewer_count) {
    faults.push({
      code: "MIN_REVIEWER_PAIR_REQUIRED",
      message: `Governed review requires at least ${bootstrap.minimum_reviewer_count} reviewers, got ${reviewers.length}.`,
    });
  }

  if (bootstrap.reviewer_count_must_be_even && reviewers.length % 2 !== 0) {
    faults.push({
      code: "ODD_REVIEWER_COUNT",
      message: `Reviewer roster must contain complete adjacent pairs, got odd reviewer count (${reviewers.length}).`,
    });
  }

  for (let index = 0; index < reviewers.length; index += 2) {
    if (index + 1 >= reviewers.length) {
      continue;
    }

    const providers = [reviewers[index].provider, reviewers[index + 1].provider]
      .map((provider) => provider.toLowerCase())
      .sort();
    if (providers[0] !== "claude" || providers[1] !== "codex") {
      faults.push({
        code: "INVALID_REVIEWER_PAIR",
        message: `Reviewer pair ${index / 2 + 1} must be one Codex + one Claude, got: ${reviewers[index].provider} + ${reviewers[index + 1].provider}`,
      });
    }
  }

  return faults;
}

export async function createPilotGovernanceContext(input: PilotGovernanceContextInput): Promise<PilotGovernanceContext> {
  const snapshotId = randomUUID();
  const snapshotRoot = normalizePath(join(input.run_dir, "governance"));
  const snapshotManifestPath = normalizePath(join(input.run_dir, "governance-snapshot.json"));
  const rewriteMap = buildRewriteMap(input.authority, snapshotRoot);

  await mkdir(snapshotRoot, { recursive: true });

  const governedFiles = await Promise.all([
    copyRequiredFile("shared_contract", input.authority.shared_contract, lookupSnapshotPath(rewriteMap, input.authority.shared_contract), toRepoRelativePath(input.authority.shared_contract)),
    copyRequiredFile("component_contract", input.authority.component_contract, lookupSnapshotPath(rewriteMap, input.authority.component_contract), toRepoRelativePath(input.authority.component_contract), rewriteMap),
    copyRequiredFile("component_rulebook", input.authority.component_rulebook, lookupSnapshotPath(rewriteMap, input.authority.component_rulebook), toRepoRelativePath(input.authority.component_rulebook)),
    copyRequiredFile("component_review_prompt", input.authority.component_review_prompt, lookupSnapshotPath(rewriteMap, input.authority.component_review_prompt), toRepoRelativePath(input.authority.component_review_prompt), rewriteMap),
  ]);
  const authorityDocs = await Promise.all(
    input.authority.authority_docs.map((repoPath) =>
      copyRequiredFile("authority_doc", repoPath, lookupSnapshotPath(rewriteMap, repoPath), toRepoRelativePath(repoPath))
    )
  );

  const snapshot: GovernanceSnapshot = {
    snapshot_id: snapshotId,
    component: input.component,
    governed_files: governedFiles,
    authority_docs: authorityDocs,
  };
  await writeJson(snapshotManifestPath, snapshot);

  await validateSnapshotAuthorityIdentity(
    lookupSnapshotPath(rewriteMap, input.authority.component_review_prompt),
    lookupSnapshotPath(rewriteMap, input.authority.component_contract),
    input.authority.authority_docs,
    rewriteMap
  );

  const reviewRuntimeConfig = await loadReviewRuntimeConfigFromPaths({
    sharedContractPath: lookupSnapshotPath(rewriteMap, input.authority.shared_contract),
    componentPromptPath: lookupSnapshotPath(rewriteMap, input.authority.component_review_prompt),
    componentContractPath: lookupSnapshotPath(rewriteMap, input.authority.component_contract),
  });

  return {
    snapshot_id: snapshotId,
    snapshot_manifest_path: snapshotManifestPath,
    snapshot_root: snapshotRoot,
    shared_contract_path: lookupSnapshotPath(rewriteMap, input.authority.shared_contract),
    component_contract_path: lookupSnapshotPath(rewriteMap, input.authority.component_contract),
    component_rulebook_path: lookupSnapshotPath(rewriteMap, input.authority.component_rulebook),
    component_review_prompt_path: lookupSnapshotPath(rewriteMap, input.authority.component_review_prompt),
    authority_doc_paths: input.authority.authority_docs.map((repoPath) => lookupSnapshotPath(rewriteMap, repoPath)),
    review_runtime_config: reviewRuntimeConfig,
  };
}

export async function loadPilotReviewRuntimeConfig(context: Pick<PilotGovernanceContext, "shared_contract_path" | "component_review_prompt_path" | "component_contract_path">) {
  return loadReviewRuntimeConfigFromPaths({
    sharedContractPath: context.shared_contract_path,
    componentPromptPath: context.component_review_prompt_path,
    componentContractPath: context.component_contract_path,
  });
}

export async function readGovernanceBindingFromManifest(snapshotManifestPath: string): Promise<GovernanceBinding> {
  const snapshot = await readJsonRequired<GovernanceSnapshot>(snapshotManifestPath, "governance snapshot manifest");
  return {
    snapshot_id: snapshot.snapshot_id,
    snapshot_manifest_path: normalizePath(snapshotManifestPath),
  };
}

export function resolvePilotTerminalVerdict(input: TerminalLegalityInput): TerminalLegalityDecision {
  if (input.leaderVerdict === "frozen" && input.hasMaterialRepairWork) {
    return {
      effectiveVerdict: input.finalRound ? "blocked" : "pushback",
      overrideReason: "Leader returned frozen while material repair work remained, which violates the freeze contract.",
    };
  }

  if (input.leaderVerdict === "frozen" && input.hasAnyRepairWork) {
    return {
      effectiveVerdict: input.finalRound ? "frozen_with_conditions" : "pushback",
      overrideReason: "Leader returned frozen while non-material repair work remained. Clean freeze is only legal when no repair work remains.",
    };
  }

  if (input.leaderVerdict === "frozen_with_conditions" && input.hasMaterialRepairWork) {
    return {
      effectiveVerdict: input.finalRound ? "blocked" : "pushback",
      overrideReason: "Leader returned frozen_with_conditions while material repair work remained, which violates the arbitration contract.",
    };
  }

  return {
    effectiveVerdict: input.leaderVerdict,
    overrideReason: null,
  };
}

export function buildGovernanceBinding(context: Pick<PilotGovernanceContext, "snapshot_id" | "snapshot_manifest_path">): GovernanceBinding {
  return {
    snapshot_id: context.snapshot_id,
    snapshot_manifest_path: context.snapshot_manifest_path,
  };
}

export function bindGovernance<T extends Record<string, unknown>>(
  payload: T,
  context: Pick<PilotGovernanceContext, "snapshot_id" | "snapshot_manifest_path">
): T & { governance_binding: GovernanceBinding } {
  return {
    ...payload,
    governance_binding: buildGovernanceBinding(context),
  };
}

export async function writeGovernanceIncident(path: string, incident: GovernanceIncident): Promise<void> {
  await writeJson(path, incident);
}

function buildRewriteMap(authority: PilotAuthorityInputPaths, snapshotRoot: string): Record<string, string> {
  const rewriteMap: Record<string, string> = {};
  const allPaths = [
    authority.shared_contract,
    authority.component_contract,
    authority.component_rulebook,
    authority.component_review_prompt,
    ...authority.authority_docs,
  ];

  for (const sourcePath of allPaths) {
    const repoPath = toRepoRelativePath(sourcePath);
    rewriteMap[repoPath] = normalizePath(join(snapshotRoot, repoPath));
  }

  return rewriteMap;
}

async function copyRequiredFile(
  kind: string,
  sourcePath: string,
  snapshotPath: string,
  repoPath: string,
  rewriteMap?: Record<string, string>
) {
  await mkdir(dirname(snapshotPath), { recursive: true });
  const raw = await readFile(sourcePath, "utf-8");
  const content = rewriteMap
    ? JSON.stringify(rewriteKnownAuthorityPaths(parseJsonTextWithBomSupport<unknown>(raw, `${kind} snapshot source`).value, rewriteMap), null, 2)
    : raw;
  await writeFile(snapshotPath, content, "utf-8");

  return {
    kind,
    repo_path: repoPath,
    snapshot_path: normalizePath(snapshotPath),
    source_sha256: sha256(raw),
    snapshot_sha256: sha256(content),
  };
}

function rewriteKnownAuthorityPaths(value: unknown, rewriteMap: Record<string, string>): unknown {
  if (typeof value === "string") {
    const exactMatch = rewriteMap[normalizePath(value)];
    if (exactMatch) {
      return exactMatch;
    }

    const repoRelativePath = tryToRepoRelativePath(value);
    return repoRelativePath ? (rewriteMap[repoRelativePath] ?? value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => rewriteKnownAuthorityPaths(entry, rewriteMap));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, rewriteKnownAuthorityPaths(entry, rewriteMap)])
    );
  }
  return value;
}

async function validateSnapshotAuthorityIdentity(
  promptSnapshotPath: string,
  contractSnapshotPath: string,
  expectedAuthorityRepoPaths: string[],
  rewriteMap: Record<string, string>
): Promise<void> {
  const inverseMap = new Map<string, string>(
    Object.entries(rewriteMap).map(([repoPath, snapshotPath]) => [normalizePath(snapshotPath), normalizePath(repoPath)])
  );
  const expected = new Set(expectedAuthorityRepoPaths.map((path) => toRepoRelativePath(path)));
  const prompt = await readJsonRequired<Record<string, unknown>>(promptSnapshotPath, "snapshot review prompt");
  const contract = await readJsonRequired<Record<string, unknown>>(contractSnapshotPath, "snapshot component review contract");

  for (const [label, source] of [
    ["component_review_prompt.source_authority_paths", prompt.source_authority_paths],
    ["component_contract.source_authority_paths", contract.source_authority_paths],
  ] as const) {
    if (!Array.isArray(source) || source.some((entry) => typeof entry !== "string")) {
      throw new Error(`[governance-runtime] ${label} must be an array of strings in the rewritten snapshot file.`);
    }

    const resolved = new Set<string>();
    for (const value of source) {
      const snapshotValue = normalizePath(value);
      const repoPath = inverseMap.get(snapshotValue);
      if (!repoPath || !expected.has(repoPath)) {
        throw new Error(`[governance-runtime] ${label} contains an unexpected authority path: ${value}`);
      }
      resolved.add(repoPath);
    }

    if (resolved.size !== expected.size || [...expected].some((path) => !resolved.has(path))) {
      throw new Error(`[governance-runtime] ${label} must resolve back to exactly the frozen two-doc authority set.`);
    }
  }
}

function lookupSnapshotPath(rewriteMap: Record<string, string>, sourcePath: string): string {
  const repoPath = toRepoRelativePath(sourcePath);
  const snapshotPath = rewriteMap[repoPath];
  if (!snapshotPath) {
    throw new Error(`[governance-runtime] Missing snapshot rewrite target for ${sourcePath}`);
  }
  return snapshotPath;
}

async function readJsonRequired<T>(path: string, label: string): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (error) {
    throw new Error(`[governance-runtime] Failed to read required ${label} at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    return parseJsonTextWithBomSupport<T>(raw, `${label} at ${path}`).value;
  } catch (error) {
    throw new Error(`[governance-runtime] ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function toRepoRelativePath(pathValue: string): string {
  const normalizedInput = normalizePath(pathValue);
  if (!isAbsolute(pathValue)) {
    return normalizedInput;
  }

  const repoRoot = resolve(process.cwd());
  const absolutePath = resolve(pathValue);
  const repoRelative = normalizePath(relative(repoRoot, absolutePath));
  if (repoRelative.startsWith("../") || repoRelative === "..") {
    throw new Error(`[governance-runtime] Absolute authority path is outside the repo root and is not allowed in the frozen V1 pilot: ${normalizedInput}`);
  }
  return repoRelative;
}

function tryToRepoRelativePath(pathValue: string): string | null {
  try {
    return toRepoRelativePath(pathValue);
  } catch {
    return null;
  }
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), "utf-8");
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`[governance-runtime] ${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`[governance-runtime] ${label} must be a non-empty string.`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`[governance-runtime] ${label} must be a boolean.`);
  }
  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`[governance-runtime] ${label} must be a finite number.`);
  }
  return value;
}
