import type { ContentType, ContextPriority, CompressionPolicy } from "../schemas/memory-item.js";

const HIGH_PRIORITY_TAGS = new Set([
  "mandatory",
  "brain-governance",
  "rules",
  "ceo-cto",
  "workflow",
]);

const LOW_PRIORITY_TAGS = new Set([
  "implementation-summary",
  "phase-closeout",
  "ops-log",
  "artifact-log",
]);

export function resolveContextPriority(
  contentType: ContentType,
  tags: string[]
): ContextPriority {
  const normalizedTags = normalizeTags(tags);

  if (
    contentType === "requirement" ||
    contentType === "convention" ||
    normalizedTags.some((t) => HIGH_PRIORITY_TAGS.has(t))
  ) {
    return "p0";
  }

  if (contentType === "decision") {
    return "p1";
  }

  if (normalizedTags.some((t) => LOW_PRIORITY_TAGS.has(t))) {
    return "p3";
  }

  return "p2";
}

export function resolveCompressionPolicy(
  contentType: ContentType,
  tags: string[]
): CompressionPolicy {
  const priority = resolveContextPriority(contentType, tags);
  switch (priority) {
    case "p0":
      return "full";
    case "p1":
      return "executive";
    case "p2":
      return "bullet";
    case "p3":
      return "drop";
  }
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.toLowerCase().trim()))].sort();
}
