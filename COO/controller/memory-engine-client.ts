import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Provenance } from "../../shared/provenance/types.js";

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
    const sdkBase = resolve(
      projectRoot,
      "components",
      "memory-engine",
      "node_modules",
      "@modelcontextprotocol",
      "sdk",
      "dist",
      "esm",
      "client"
    );
    const [{ Client }, { StdioClientTransport }] = await Promise.all([
      import(pathToFileURL(resolve(sdkBase, "index.js")).href),
      import(pathToFileURL(resolve(sdkBase, "stdio.js")).href),
    ]);

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(projectRoot, "components", "memory-engine", "dist", "server.js")],
      cwd: projectRoot,
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

  async searchMemory(query: string, provenance: Provenance): Promise<Array<Record<string, unknown>>> {
    return this.callJsonTool("search_memory", {
      query,
      max_results: 10,
      provenance,
    });
  }

  async captureMemory(
    content: string | Record<string, unknown>,
    contentType: string,
    tags: string[],
    provenance: Provenance
  ): Promise<Record<string, unknown>> {
    return this.callJsonTool("capture_memory", {
      content,
      content_type: contentType,
      tags,
      provenance,
    });
  }

  async logDecision(
    title: string,
    reasoning: string,
    alternatives: unknown[],
    provenance: Provenance
  ): Promise<Record<string, unknown>> {
    return this.callJsonTool("log_decision", {
      title,
      reasoning,
      alternatives_considered: alternatives,
      provenance,
    });
  }

  async createRule(
    title: string,
    body: string,
    tags: string[],
    provenance: Provenance
  ): Promise<Record<string, unknown>> {
    return this.callJsonTool("rules_manage", {
      action: "create",
      title,
      body: { text: body },
      tags,
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
