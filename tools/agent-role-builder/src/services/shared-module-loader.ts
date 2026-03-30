import { access } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function importSharedModule(sourceRelativePath: string, distRelativePath: string) {
  const candidates = [
    join(process.cwd(), sourceRelativePath),
    join(process.cwd(), "shared", "dist", distRelativePath),
  ];

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

export async function loadSharedLearningEngineModule() {
  return importSharedModule(
    join("shared", "learning-engine", "engine.ts"),
    join("learning-engine", "engine.js")
  );
}

export async function loadSharedComponentRepairEngineModule() {
  return importSharedModule(
    join("shared", "component-repair-engine", "engine.ts"),
    join("component-repair-engine", "engine.js")
  );
}

export async function loadSharedGovernanceRuntimeModule() {
  return importSharedModule(
    join("shared", "governance-runtime", "engine.ts"),
    join("governance-runtime", "engine.js")
  );
}
