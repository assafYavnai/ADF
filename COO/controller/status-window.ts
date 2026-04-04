import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface StatusUpdateAnchor {
  renderedAt: string;
  headCommit: string | null;
}

export interface GitStatusWindow {
  currentRenderedAt: string;
  previousRenderedAt: string | null;
  previousHeadCommit: string | null;
  currentHeadCommit: string | null;
  verificationBasis: "previous_head_commit" | "previous_rendered_at" | "baseline_not_established" | "unavailable";
  gitAvailable: boolean;
  commitsSincePrevious: number;
  changedFeatureSlugs: string[];
  droppedFeatureSlugs: string[];
  verificationNotes: string[];
  redFlag: boolean;
}

export interface GitStatusWindowOptions {
  projectRoot: string;
  currentRenderedAt: string;
  previousAnchor: StatusUpdateAnchor | null;
  surfacedFeatureIds: string[];
}

interface GitCommitRecord {
  sha: string;
  subject: string;
  files: string[];
}

interface GitCommandResult {
  available: boolean;
  output: string | null;
}

interface CommitLoadResult {
  available: boolean;
  verificationBasis: GitStatusWindow["verificationBasis"];
  commits: GitCommitRecord[];
}

export async function loadStatusUpdateAnchor(projectRoot: string): Promise<StatusUpdateAnchor | null> {
  const statePath = resolveStatusWindowPath(projectRoot);
  try {
    const raw = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StatusUpdateAnchor>;
    return {
      renderedAt: typeof parsed.renderedAt === "string" ? parsed.renderedAt : new Date().toISOString(),
      headCommit: typeof parsed.headCommit === "string" ? parsed.headCommit : null,
    };
  } catch {
    return null;
  }
}

export async function saveStatusUpdateAnchor(
  projectRoot: string,
  anchor: StatusUpdateAnchor,
): Promise<void> {
  const statePath = resolveStatusWindowPath(projectRoot);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(anchor, null, 2)}\n`, "utf-8");
}

export async function inspectGitStatusWindow(
  options: GitStatusWindowOptions,
): Promise<GitStatusWindow> {
  const currentHeadResult = await safeGit(options.projectRoot, ["rev-parse", "HEAD"]);
  const currentHeadCommit = currentHeadResult.output;
  const surfaced = new Set(options.surfacedFeatureIds.map(normalizeFeatureId));

  if (!options.previousAnchor) {
    return {
      currentRenderedAt: options.currentRenderedAt,
      previousRenderedAt: null,
      previousHeadCommit: null,
      currentHeadCommit,
      verificationBasis: "baseline_not_established",
      gitAvailable: currentHeadResult.available,
      commitsSincePrevious: 0,
      changedFeatureSlugs: [],
      droppedFeatureSlugs: [],
      verificationNotes: currentHeadResult.available
        ? ["No previous COO status update is recorded yet, so git comparison will start after this run."]
        : ["Git history could not be read in this runtime, so comparison will stay unavailable until git becomes readable."],
      redFlag: false,
    };
  }

  const commitLoad = await loadCommitsSince(options.projectRoot, options.previousAnchor);
  const commits = commitLoad.commits;
  const changedFeatureSlugs = uniqueStrings([
    ...commits.flatMap((commit) => extractFeatureSlugsFromCommit(commit)),
  ]);
  const droppedFeatureSlugs = changedFeatureSlugs.filter((slug) => !surfaced.has(normalizeFeatureId(slug)));
  const verificationNotes: string[] = [];

  if (!commitLoad.available) {
    verificationNotes.push("Git history could not be read for this comparison window, so coverage checks are unavailable.");
  } else if (commits.length === 0) {
    verificationNotes.push("Git shows no new commits since the previous status update.");
  } else {
    verificationNotes.push(`Git checked ${commits.length} commit(s) since the previous status update.`);
  }

  if (droppedFeatureSlugs.length > 0) {
    verificationNotes.push(`Red flag: git shows recent work on ${droppedFeatureSlugs.join(", ")}, but the current COO surface does not carry it.`);
  }

    return {
      currentRenderedAt: options.currentRenderedAt,
      previousRenderedAt: options.previousAnchor.renderedAt,
      previousHeadCommit: options.previousAnchor.headCommit,
      currentHeadCommit,
      verificationBasis: commitLoad.verificationBasis,
      gitAvailable: commitLoad.available,
      commitsSincePrevious: commits.length,
      changedFeatureSlugs,
      droppedFeatureSlugs,
      verificationNotes,
      redFlag: commitLoad.available && droppedFeatureSlugs.length > 0,
    };
}

function resolveStatusWindowPath(projectRoot: string): string {
  return resolve(projectRoot, ".codex", "runtime", "coo-live-status-window.json");
}

async function loadCommitsSince(
  projectRoot: string,
  previousAnchor: StatusUpdateAnchor,
): Promise<CommitLoadResult> {
  const range = previousAnchor.headCommit
    ? await isKnownCommit(projectRoot, previousAnchor.headCommit)
      ? `${previousAnchor.headCommit}..HEAD`
      : null
    : null;

  const args = [
    "log",
    "--format=commit:%H%x09%s",
    "--name-only",
  ];

  if (range) {
    args.push(range);
  } else if (previousAnchor.renderedAt) {
    args.push(`--since=${previousAnchor.renderedAt}`);
  } else {
    return {
      available: true,
      verificationBasis: "baseline_not_established",
      commits: [],
    };
  }

  const raw = await safeGit(projectRoot, args);
  if (!raw.available) {
    return {
      available: false,
      verificationBasis: "unavailable",
      commits: [],
    };
  }

  return {
    available: true,
    verificationBasis: range ? "previous_head_commit" : "previous_rendered_at",
    commits: raw.output ? parseGitLog(raw.output) : [],
  };
}

async function isKnownCommit(projectRoot: string, commitSha: string): Promise<boolean> {
  const result = await safeGit(projectRoot, ["rev-parse", "--verify", `${commitSha}^{commit}`]);
  return Boolean(result.output);
}

function parseGitLog(raw: string): GitCommitRecord[] {
  const records: GitCommitRecord[] = [];
  let current: GitCommitRecord | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("commit:")) {
      if (current) {
        records.push(current);
      }
      const [, sha = "", subject = ""] = /^commit:([0-9a-f]+)\t?(.*)$/i.exec(trimmed) ?? [];
      current = { sha, subject, files: [] };
      continue;
    }

    current?.files.push(trimmed);
  }

  if (current) {
    records.push(current);
  }

  return records;
}

function extractFeatureSlugsFromCommit(commit: GitCommitRecord): string[] {
  const slugs = new Set<string>();

  for (const file of commit.files) {
    const normalized = file.replace(/\\/g, "/");
    const match = normalized.match(/docs\/phase1\/([^/]+)\//i);
    if (match) {
      slugs.add(normalizeFeatureId(match[1]));
    }
  }

  for (const match of commit.subject.matchAll(/\(([^)]+)\)/g)) {
    const candidate = normalizeFeatureId(match[1]);
    if (candidate.includes("/") || candidate.includes("-")) {
      slugs.add(candidate);
    }
  }

  return Array.from(slugs);
}

async function safeGit(projectRoot: string, args: string[]): Promise<GitCommandResult> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", projectRoot, ...args], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const trimmed = stdout.trim();
    return {
      available: true,
      output: trimmed.length > 0 ? trimmed : null,
    };
  } catch {
    return {
      available: false,
      output: null,
    };
  }
}

function normalizeFeatureId(value: string): string {
  const normalized = value.replace(/\\/g, "/").trim();
  const segments = normalized
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const candidate = segments.at(-1) ?? normalized;
  return candidate.toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
