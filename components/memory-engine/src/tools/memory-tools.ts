const PROVENANCE_SCHEMA = {
  type: "object",
  description: "Provenance object from caller (invocation_id, provider, model, reasoning, was_fallback, source_path, timestamp)",
  properties: {
    invocation_id: { type: "string", format: "uuid" },
    provider: { type: "string" },
    model: { type: "string" },
    reasoning: { type: "string" },
    was_fallback: { type: "boolean" },
    source_path: { type: "string" },
    timestamp: { type: "string" },
  },
};

export const MEMORY_TOOL_DEFINITIONS = [
  {
    name: "capture_memory",
    description: "Store a memory item (thought, decision, context, lesson) with auto-embedding and deduplication",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: { oneOf: [{ type: "string" }, { type: "object" }], description: "Content to store" },
        content_type: { type: "string", enum: ["text", "decision", "intent", "context", "lesson", "convention", "requirement", "note"], default: "text" },
        scope: { type: "string", description: "Scope path (org/project/initiative/phase/thread)" },
        tags: { type: "array", items: { type: "string" }, default: [] },
        trust_level: { type: "string", enum: ["working", "reviewed", "locked"], default: "working" },
        skip_dedup: { type: "boolean", default: false },
        provenance: PROVENANCE_SCHEMA,
      },
      required: ["content"],
    },
  },
  {
    name: "search_memory",
    description: "Hybrid semantic + keyword search across memory items",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        scope: { type: "string", description: "Scope path to filter" },
        content_type: { type: "string", enum: ["text", "decision", "intent", "context", "lesson", "convention", "requirement", "note"] },
        semantic_weight: { type: "number", minimum: 0, maximum: 1, default: 0.7 },
        max_results: { type: "number", minimum: 1, maximum: 100, default: 10 },
        provenance: PROVENANCE_SCHEMA,
      },
      required: ["query"],
    },
  },
  {
    name: "get_context_summary",
    description: "Get priority-sorted context summary for a scope",
    inputSchema: {
      type: "object" as const,
      properties: {
        scope: { type: "string" },
        content_type: { type: "string" },
        limit: { type: "number", default: 50 },
        provenance: PROVENANCE_SCHEMA,
      },
    },
  },
  {
    name: "list_recent",
    description: "List recent memory items with pagination",
    inputSchema: {
      type: "object" as const,
      properties: {
        scope: { type: "string" },
        content_type: { type: "string" },
        limit: { type: "number", default: 20 },
        offset: { type: "number", default: 0 },
        provenance: PROVENANCE_SCHEMA,
      },
    },
  },
  {
    name: "memory_manage",
    description: "Delete, archive, update tags, or change trust level of memory items",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["delete", "archive", "update_tags", "update_trust_level"] },
        memory_id: { type: "string", format: "uuid" },
        tags: { type: "array", items: { type: "string" } },
        trust_level: { type: "string", enum: ["working", "reviewed", "locked"] },
        reason: { type: "string" },
        provenance: PROVENANCE_SCHEMA,
      },
      required: ["action", "memory_id"],
    },
  },
];
