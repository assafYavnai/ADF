import { access } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function importSharedModule(sourceRelativePath: string, distRelativePath: string) {
  return importModuleCandidates([
    join(process.cwd(), sourceRelativePath),
    join(process.cwd(), "shared", "dist", distRelativePath),
  ]);
}

async function importToolModule(sourceRelativePath: string, distRelativePath: string) {
  return importModuleCandidates([
    join(process.cwd(), sourceRelativePath),
    join(process.cwd(), distRelativePath),
  ]);
}

async function importModuleCandidates(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code === "ENOENT") {
        continue;
      }
      throw error;
    }

    return import(pathToFileURL(candidate).href);
  }

  throw new Error(
    `Shared module not found. Tried: ${candidates.map((candidate) => candidate.replace(/\\/g, "/")).join(", ")}`
  );
}

export async function loadSharedReviewEngineModule() {
  return importSharedModule(
    join("shared", "review-engine", "engine.ts"),
    join("review-engine", "engine.js")
  );
}

export async function loadSharedSelfLearningEngineModule() {
  return importSharedModule(
    join("shared", "self-learning-engine", "engine.ts"),
    join("self-learning-engine", "engine.js")
  );
}

export async function loadSharedLearningEngineModule() {
  return loadSharedSelfLearningEngineModule();
}

export async function loadSharedRulesComplianceEnforcerModule() {
  return importSharedModule(
    join("shared", "rules-compliance-enforcer", "engine.ts"),
    join("rules-compliance-enforcer", "engine.js")
  );
}

export async function loadSharedComponentRepairEngineModule() {
  return loadSharedRulesComplianceEnforcerModule();
}

export async function loadSharedGovernanceRuntimeModule() {
  return importSharedModule(
    join("shared", "governance-runtime", "engine.ts"),
    join("governance-runtime", "engine.js")
  );
}

export async function loadSelfRepairEngineModule() {
  return importToolModule(
    join("tools", "self-repair-engine", "src", "index.ts"),
    join("tools", "self-repair-engine", "dist", "index.js")
  );
}
