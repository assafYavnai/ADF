#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  booleanArg,
  isFilled,
  normalizeProjectRoot,
  normalizeSlashes,
  nowIso,
  parseArgs,
  parsePositiveInteger,
  printJson,
  requiredArg,
  fail,
  pathExists
} from "../../governed-feature-runtime.mjs";

const scriptName = "skills/brain-ops/scripts/brain-ops-helper.mjs";
const TRUST_LEVELS = new Set(["working", "reviewed", "locked"]);
const TRUST_ACTIONS = new Set(["promote", "cleanup"]);
const CLEANUP_ACTIONS = new Set(["archive", "delete", "supersede"]);

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
});

async function main() {
  const args = parseArgs(process.argv.slice(2), ["tag"]);
  const command = resolveCommand(args);

  if (command === "help") {
    printJson(renderHelp(args));
    return;
  }

  const projectRoot = normalizeProjectRoot(requiredProjectRoot(args));

  if (command === "connect-smoke") {
    printJson(await runConnectSmoke(projectRoot));
    return;
  }

  if (command === "search") {
    printJson(await runSearch(projectRoot, {
      scope: requiredArg(args, "scope"),
      query: requiredArg(args, "query"),
      contentType: maybeValue(args.values["content-type"]),
      contentTypes: parseCsv(args.values["content-types"]),
      trustLevels: parseCsv(args.values["trust-levels"]),
      maxResults: parseOptionalPositiveInteger(args.values["max-results"]),
      includeLegacy: booleanArg(args, "include-legacy", false)
    }));
    return;
  }

  if (command === "read") {
    printJson(await runRead(projectRoot, {
      scope: requiredArg(args, "scope"),
      query: requiredArg(args, "query"),
      contentType: maybeValue(args.values["content-type"]),
      contentTypes: parseCsv(args.values["content-types"]),
      trustLevels: parseCsv(args.values["trust-levels"]),
      maxResults: parseOptionalPositiveInteger(args.values["max-results"]),
      includeLegacy: booleanArg(args, "include-legacy", false),
      memoryId: maybeValue(args.values["memory-id"])
    }));
    return;
  }

  if (command === "capture") {
    printJson(await runCapture(projectRoot, {
      scope: requiredArg(args, "scope"),
      contentType: requiredArg(args, "content-type"),
      title: requiredArg(args, "title"),
      summary: requiredArg(args, "summary"),
      trustLevel: maybeValue(args.values["trust-level"]),
      content: await resolveCaptureContent(args),
      tags: parseTags(args)
    }));
    return;
  }

  if (command === "trust") {
    printJson(await runTrust(projectRoot, {
      scope: requiredArg(args, "scope"),
      memoryId: requiredArg(args, "memory-id"),
      action: normalizeTrustAction(args.values.action),
      trustLevel: maybeValue(args.values["trust-level"]),
      cleanupAction: normalizeCleanupAction(maybeValue(args.values["cleanup-action"])),
      reason: maybeValue(args.values.reason)
    }));
    return;
  }

  fail(`Unknown command '${command}'. Use help, connect-smoke, search, read, capture, or trust.`);
}

function resolveCommand(args) {
  if (args.positionals.length > 0 && isFilled(args.positionals[0])) {
    return String(args.positionals[0]).toLowerCase();
  }
  if (isFilled(args.values.action)) {
    return String(args.values.action).toLowerCase();
  }
  return "help";
}

function requiredProjectRoot(args) {
  const value = args.values["project-root"];
  if (!isFilled(value)) {
    fail("Missing required argument --project-root.");
  }
  return value;
}

function maybeValue(value) {
  return isFilled(value) ? String(value) : null;
}

function parseCsv(value) {
  if (!isFilled(value)) {
    return [];
  }

  return String(value)
    .split(",")
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

function parseTags(args) {
  const repeated = Array.isArray(args.multi.tag) ? args.multi.tag : [];
  const inline = parseCsv(args.values.tags);
  const merged = [...inline, ...repeated].filter(Boolean);
  return [...new Set(merged.map((tag) => String(tag).trim()).filter(Boolean))];
}

function parseOptionalPositiveInteger(rawValue) {
  if (!isFilled(rawValue)) {
    return null;
  }
  return parsePositiveInteger(rawValue, "max-results");
}

function normalizeTrustAction(value) {
  if (!isFilled(value)) {
    fail("Missing required argument --action.");
  }
  const normalized = String(value).toLowerCase();
  if (!TRUST_ACTIONS.has(normalized)) {
    fail("--action must be promote or cleanup.");
  }
  return normalized;
}

function normalizeCleanupAction(value) {
  if (!isFilled(value)) {
    return "archive";
  }
  const normalized = String(value).toLowerCase();
  if (!CLEANUP_ACTIONS.has(normalized)) {
    fail("--cleanup-action must be archive, delete, or supersede.");
  }
  return normalized;
}

async function runConnectSmoke(projectRoot) {
  const startedAt = nowIso();
  const client = await connectBrain(projectRoot);

  try {
    await client.close();
  } catch (error) {
    throw new Error(`connect-smoke failed during close: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    command: "connect-smoke",
    status: "ok",
    route: "repo-fallback",
    project_root: normalizeSlashes(projectRoot),
    runtime_root: normalizeSlashes(client.runtimeRoot),
    started_at: startedAt,
    completed_at: nowIso()
  };
}

async function runSearch(projectRoot, options) {
  const startedAt = nowIso();
  const client = await connectBrain(projectRoot);
  try {
    const args = {
      query: options.query,
      scope: options.scope,
      include_legacy: options.includeLegacy
    };

    if (isFilled(options.contentType)) {
      args.content_type = options.contentType;
    }
    if (options.contentTypes.length > 0) {
      args.content_types = options.contentTypes;
    }
    if (options.trustLevels.length > 0) {
      args.trust_levels = options.trustLevels;
    }
    if (options.maxResults !== null) {
      args.max_results = options.maxResults;
    }

    const result = await client.searchMemory(args);

    const safeResult = Array.isArray(result) ? result : [];
    return {
      command: "search",
      route: "repo-fallback",
      project_root: normalizeSlashes(projectRoot),
      runtime_root: normalizeSlashes(client.runtimeRoot),
      scope: options.scope,
      query: options.query,
      started_at: startedAt,
      completed_at: nowIso(),
      results_count: safeResult.length,
      results: safeResult
    };
  } finally {
    await client.close();
  }
}

async function runRead(projectRoot, options) {
  const startedAt = nowIso();
  const search = await runSearch(projectRoot, {
    scope: options.scope,
    query: options.query,
    contentType: options.contentType,
    contentTypes: options.contentTypes,
    trustLevels: options.trustLevels,
    maxResults: options.maxResults ?? 20,
    includeLegacy: options.includeLegacy
  });

  const entries = Array.isArray(search.results) ? search.results : [];
  if (entries.length === 0) {
    return {
      command: "read",
      status: "not_found",
      route: "repo-fallback",
      project_root: normalizeSlashes(projectRoot),
      runtime_root: normalizeSlashes(search.runtime_root ?? projectRoot),
      scope: options.scope,
      query: options.query,
      started_at: startedAt,
      completed_at: nowIso(),
      reason: "No matching memory records found."
    };
  }

  let selected = entries[0];
  if (options.memoryId) {
    const match = entries.find((entry) => getMemoryId(entry) === options.memoryId);
    if (!match) {
      return {
        command: "read",
        status: "not_found",
        route: "repo-fallback",
        project_root: normalizeSlashes(projectRoot),
        runtime_root: normalizeSlashes(search.runtime_root ?? projectRoot),
        scope: options.scope,
        query: options.query,
        memory_id: options.memoryId,
        started_at: startedAt,
        completed_at: nowIso(),
        reason: "Requested memory_id was not found in search results."
      };
    }
    selected = match;
  }

  return {
    command: "read",
    status: "ok",
    route: "repo-fallback",
    project_root: normalizeSlashes(projectRoot),
    runtime_root: normalizeSlashes(search.runtime_root ?? projectRoot),
    scope: options.scope,
    query: options.query,
    memory_id: getMemoryId(selected),
    started_at: startedAt,
    completed_at: nowIso(),
    entry: selected
  };
}

async function runCapture(projectRoot, options) {
  const startedAt = nowIso();
  const client = await connectBrain(projectRoot);
  const content = options.content;
  const payload = {
    title: options.title,
    summary: options.summary,
    started_at: startedAt,
    completed_at: nowIso(),
    body_source: content?.source ?? "none",
    body: content?.value
  };

  try {
    const result = await client.captureMemory({
      content: payload,
      content_type: options.contentType,
      tags: options.tags,
      scope: options.scope
    });

    const memoryId = getMemoryId(result);
    let trustResult = null;

    const normalizedTrustLevel = parseTrustLevel(options.trustLevel);
    if (normalizedTrustLevel) {
      if (!memoryId) {
        throw new Error("Cannot promote trust: capture response did not include a memory id.");
      }
      trustResult = await runTrust(projectRoot, {
        scope: options.scope,
        memoryId,
        action: "promote",
        trustLevel: normalizedTrustLevel,
        cleanupAction: "archive",
        reason: "capture trust promotion"
      });
    }

    return {
      command: "capture",
      status: trustResult ? "ok_with_trust" : "ok",
      route: "repo-fallback",
      project_root: normalizeSlashes(projectRoot),
      runtime_root: normalizeSlashes(client.runtimeRoot),
      scope: options.scope,
      memory_id: memoryId,
      started_at: startedAt,
      completed_at: nowIso(),
      capture_input: {
        content_type: options.contentType,
        tags: options.tags,
        trust_level: normalizedTrustLevel ?? null
      },
      capture_result: result,
      trust_result: trustResult
    };
  } finally {
    await client.close();
  }
}

async function runTrust(projectRoot, options) {
  const startedAt = nowIso();
  const action = options.action;
  const memoryId = options.memoryId;
  const client = await connectBrain(projectRoot);

  try {
    let result;
    if (action === "promote") {
      const trustLevel = parseTrustLevel(options.trustLevel);
      if (!trustLevel) {
        fail("--trust-level is required when action=promote.");
      }
      result = await client.manageMemory({
        action: "update_trust_level",
        memory_id: memoryId,
        scope: options.scope,
        trust_level: trustLevel,
        reason: options.reason ?? "promote trust level"
      });
    } else {
      result = await client.manageMemory({
        action: options.cleanupAction,
        memory_id: memoryId,
        scope: options.scope,
        reason: options.reason ?? "cleanup"
      });
    }

    return {
      command: "trust",
      status: "ok",
      route: "repo-fallback",
      project_root: normalizeSlashes(projectRoot),
      runtime_root: normalizeSlashes(client.runtimeRoot),
      action,
      cleanup_action: action === "cleanup" ? options.cleanupAction : null,
      memory_id: memoryId,
      scope: options.scope,
      started_at: startedAt,
      completed_at: nowIso(),
      result
    };
  } finally {
    await client.close();
  }
}

async function connectBrain(projectRoot) {
  const runtimeRoot = await resolveRuntimeRoot(projectRoot);
  const clientPath = join(runtimeRoot, "COO", "dist", "COO", "controller", "memory-engine-client.js");
  const provenanceModulePath = join(runtimeRoot, "shared", "provenance", "types.js");
  const [{ MemoryEngineClient }, { createSystemProvenance }] = await Promise.all([
    import(pathToFileURL(clientPath).href),
    import(pathToFileURL(provenanceModulePath).href)
  ]);
  const client = await MemoryEngineClient.connect(runtimeRoot, {
    telemetryContext: {
      source: scriptName,
      tool: "brain-ops-helper"
    }
  });

  const provenance = createSystemProvenance(scriptName);

  return {
    runtimeRoot,
    close: async () => {
      await client.close().catch(() => {});
    },
    searchMemory: ({ query, scope, content_type, content_types, trust_levels, max_results, include_legacy }) =>
      client.searchMemory(query, scope, provenance, {
        content_type,
        content_types,
        trust_levels,
        max_results,
        include_legacy
      }),
    captureMemory: ({ content, content_type, tags, scope }) =>
      client.captureMemory(content, content_type, tags, scope, provenance),
    manageMemory: ({ action, memory_id, scope, tags, trust_level, reason }) =>
      client.manageMemory(action, memory_id, scope, provenance, {
        tags,
        trust_level,
        reason
      })
  };
}

async function resolveCaptureContent(args) {
  const contentFile = maybeValue(args.values["content-file"]);
  if (contentFile) {
    return {
      source: "content-file",
      value: await readFile(resolve(contentFile), "utf8")
    };
  }

  const contentJson = maybeValue(args.values["content-json"]);
  if (contentJson) {
    try {
      return {
        source: "content-json",
        value: JSON.parse(contentJson)
      };
    } catch {
      return {
        source: "content-json",
        value: contentJson
      };
    }
  }

  const content = maybeValue(args.values.content);
  if (content) {
    return {
      source: "content-text",
      value: content
    };
  }

  return {
    source: "none",
    value: null
  };
}

function parseTrustLevel(trustLevel) {
  if (!isFilled(trustLevel)) {
    return null;
  }
  const normalized = String(trustLevel).toLowerCase();
  if (!TRUST_LEVELS.has(normalized)) {
    fail("--trust-level must be working, reviewed, or locked.");
  }
  return normalized;
}

function getMemoryId(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  return isFilled(item.memory_id) ? String(item.memory_id)
    : isFilled(item.memoryId) ? String(item.memoryId)
    : isFilled(item.id) ? String(item.id)
    : isFilled(item.memory) ? String(item.memory)
    : isFilled(item.uuid) ? String(item.uuid)
    : null;
}

function renderHelp(args) {
  return {
    command: "help",
    command_center: "brain-ops",
    preferred_route: "project-brain MCP when exposed in assistant runtime",
    fallback_route: {
      description: "repo fallback through COO memory-engine-client via the nearest ancestor with built Brain artifacts",
      client_path_pattern: "<project-root-or-ancestor>/COO/dist/COO/controller/memory-engine-client.js"
    },
    supported_commands: ["help", "connect-smoke", "search", "read", "capture", "trust"],
    routes: {
      connect_smoke: "node skills/brain-ops/scripts/brain-ops-helper.mjs connect-smoke --project-root <repo>",
      search: "node skills/brain-ops/scripts/brain-ops-helper.mjs search --project-root <repo> --scope <scope> --query <query> [--content-type <type>]",
      read: "node skills/brain-ops/scripts/brain-ops-helper.mjs read --project-root <repo> --scope <scope> --query <query> [--memory-id <id>]",
      capture: "node skills/brain-ops/scripts/brain-ops-helper.mjs capture --project-root <repo> --scope <scope> --content-type <type> --title <title> --summary <summary> [--content|--content-file|--content-json|--tag] [--trust-level]",
      trust: "node skills/brain-ops/scripts/brain-ops-helper.mjs trust --project-root <repo> --scope <scope> --memory-id <id> --action promote|cleanup [--trust-level|--cleanup-action]"
    },
    required_root: "--project-root",
    notes: [
      "Use MCP project-brain directly when available.",
      "This helper uses the COO repo fallback path only.",
      "Do not use raw DB access.",
      "capture command supports optional --trust-level to immediately update trust."
    ]
  };
}

async function resolveRuntimeRoot(startPath) {
  let current = resolve(startPath);

  while (true) {
    const clientPath = join(current, "COO", "dist", "COO", "controller", "memory-engine-client.js");
    const provenancePath = join(current, "shared", "provenance", "types.js");
    if ((await pathExists(clientPath)) && (await pathExists(provenancePath))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  fail(
    "Brain fallback client is unavailable under the supplied project root or any ancestor. " +
    "Build COO artifacts (npm run build) in the main ADF workspace before using this helper."
  );
}
