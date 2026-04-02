import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import type { Provenance } from "../../shared/provenance/types.js";
import type { MetricEvent } from "../../shared/telemetry/types.js";

interface ToolResponse {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export class MemoryEngineClient {
  private constructor(
    private readonly client: {
      callTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<ToolResponse>;
      close?: () => Promise<void>;
    },
    private readonly transport: { close?: () => Promise<void> }
  ) {}

  static async connect(projectRoot: string): Promise<MemoryEngineClient> {
    const resolvedProjectRoot = await resolveWorkspaceRoot(projectRoot);
    const sdkBase = await resolveMcpSdkClientBase(resolvedProjectRoot);
    const serverEntrypoint = await resolveMemoryEngineServerEntrypoint(resolvedProjectRoot);
    const [{ Client }, { StdioClientTransport }] = await Promise.all([
      import(pathToFileURL(resolve(sdkBase, "index.js")).href),
      import(pathToFileURL(resolve(sdkBase, "stdio.js")).href),
    ]);

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverEntrypoint],
      cwd: resolvedProjectRoot,
      env: process.env as Record<string, string>,
      stderr: "pipe",
    });

    const client = new Client(
      { name: "ADF COO", version: "0.1.0" },
      { capabilities: {} }
    );
    await client.connect(transport);

    return new MemoryEngineClient(client, transport);
  }

  async close(): Promise<void> {
    await this.client.close?.();
    await this.transport.close?.();
  }

  async searchMemory(
    query: string,
    scope: string,
    provenance: Provenance,
    options?: {
      content_type?: string;
      content_types?: string[];
      trust_levels?: string[];
      max_results?: number;
      include_legacy?: boolean;
    }
  ): Promise<Array<Record<string, unknown>>> {
    return this.callJsonTool("search_memory", {
      query,
      scope,
      content_type: options?.content_type,
      content_types: options?.content_types,
      trust_levels: options?.trust_levels,
      max_results: options?.max_results ?? 10,
      include_legacy: options?.include_legacy ?? false,
      provenance,
    });
  }

  async captureMemory(
    content: string | Record<string, unknown>,
    contentType: string,
    tags: string[],
    scope: string,
    provenance: Provenance
  ): Promise<Record<string, unknown>> {
    return this.callJsonTool("capture_memory", {
      content,
      content_type: contentType,
      scope,
      tags,
      provenance,
    });
  }

  async logDecision(
    title: string,
    reasoning: string,
    alternatives: unknown[],
    scope: string,
    provenance: Provenance,
    contentProvenance?: Provenance
  ): Promise<Record<string, unknown>> {
    return this.callJsonTool("log_decision", {
      title,
      reasoning,
      alternatives_considered: alternatives,
      scope,
      provenance,
      content_provenance: contentProvenance,
    });
  }

  async createRule(
    title: string,
    body: string,
    tags: string[],
    scope: string,
    provenance: Provenance
  ): Promise<Record<string, unknown>> {
    return this.callJsonTool("rules_manage", {
      action: "create",
      title,
      body: { text: body },
      scope,
      tags,
      provenance,
    });
  }

  async createRequirement(
    title: string,
    body: Record<string, unknown>,
    tags: string[],
    scope: string,
    provenance: Provenance,
    options?: {
      workflow_status?: "current" | "pending_finalization" | "archived" | "superseded";
    }
  ): Promise<Record<string, unknown>> {
    return this.callJsonTool("requirements_manage", {
      action: "create",
      title,
      body,
      scope,
      tags,
      workflow_status: options?.workflow_status,
      provenance,
    });
  }

  async manageOpenLoops(
    action: "list" | "get" | "create" | "search",
    args: Record<string, unknown>,
    provenance: Provenance
  ): Promise<unknown> {
    return this.callJsonTool("open_loops_manage", {
      action,
      ...args,
      provenance,
    });
  }

  async manageMemory(
    action: "delete" | "archive" | "supersede" | "update_tags" | "update_trust_level",
    memoryId: string,
    scope: string,
    provenance: Provenance,
    options?: {
      tags?: string[];
      trust_level?: "working" | "reviewed" | "locked";
      reason?: string;
      workflow_status?: "current" | "pending_finalization" | "archived" | "superseded";
    }
  ): Promise<Record<string, unknown>> {
    return this.callJsonTool("memory_manage", {
      action,
      memory_id: memoryId,
      scope,
      tags: options?.tags,
      trust_level: options?.trust_level,
      reason: options?.reason,
      workflow_status: options?.workflow_status,
      provenance,
    });
  }

  async emitMetric(event: MetricEvent): Promise<Record<string, unknown>> {
    return this.callJsonTool("emit_metric", {
      provenance: event.provenance,
      category: event.category,
      operation: event.operation,
      latency_ms: event.latency_ms,
      success: event.success,
      tokens_in: "tokens_in" in event ? event.tokens_in : undefined,
      tokens_out: "tokens_out" in event ? event.tokens_out : undefined,
      estimated_cost_usd: "estimated_cost_usd" in event ? event.estimated_cost_usd : undefined,
      metadata: event.metadata ?? {},
    });
  }

  async emitMetricsBatch(events: MetricEvent[]): Promise<Record<string, unknown>> {
    return this.callJsonTool("emit_metrics_batch", {
      events: events.map((event) => ({
        provenance: event.provenance,
        category: event.category,
        operation: event.operation,
        latency_ms: event.latency_ms,
        success: event.success,
        tokens_in: "tokens_in" in event ? event.tokens_in : undefined,
        tokens_out: "tokens_out" in event ? event.tokens_out : undefined,
        estimated_cost_usd: "estimated_cost_usd" in event ? event.estimated_cost_usd : undefined,
        metadata: event.metadata ?? {},
      })),
    });
  }

  private async callJsonTool(name: string, args: Record<string, unknown>): Promise<any> {
    const result = await this.client.callTool({ name, arguments: args });

    if (result.isError) {
      throw new Error(this.extractText(result) ?? `MCP tool ${name} failed`);
    }

    const text = this.extractText(result);
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }

  private extractText(result: ToolResponse): string | null {
    const firstText = result.content?.find((item) => item.type === "text" && typeof item.text === "string");
    return firstText?.text?.trim() ?? null;
  }
}

async function resolveMcpSdkClientBase(projectRoot: string): Promise<string> {
  const candidates = [
    resolve(
      projectRoot,
      "components",
      "memory-engine",
      "node_modules",
      "@modelcontextprotocol",
      "sdk",
      "dist",
      "esm",
      "client"
    ),
    resolve(projectRoot, "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm", "client"),
  ];

  for (const base of candidates) {
    const hasIndex = await pathExists(resolve(base, "index.js"));
    const hasStdio = await pathExists(resolve(base, "stdio.js"));
    if (hasIndex && hasStdio) {
      return base;
    }
  }

  throw new Error(
    `Unable to locate the MCP SDK client runtime for COO bootstrap. Tried:\n- ${candidates.join("\n- ")}\nBuild/install the memory engine dependencies before starting the COO.`
  );
}

async function resolveMemoryEngineServerEntrypoint(projectRoot: string): Promise<string> {
  const candidate = resolve(projectRoot, "components", "memory-engine", "dist", "server.js");
  if (await pathExists(candidate)) {
    return candidate;
  }

  throw new Error(
    `Memory engine server entrypoint not found at ${candidate}. Run \`npm run build\` in components/memory-engine before starting the COO.`
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveWorkspaceRoot(startPath: string): Promise<string> {
  let current = resolve(startPath);

  while (true) {
    if (await pathExists(resolve(current, "components", "memory-engine", "package.json"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    `Unable to resolve the ADF workspace root from ${startPath}. Expected to find components/memory-engine/package.json in an ancestor directory.`
  );
}
