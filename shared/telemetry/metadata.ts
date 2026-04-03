import type { MetricEvent } from "./types.js";

export type TelemetryMetadataDefaults = Record<string, unknown>;

export function materializeMetricEvent(
  event: MetricEvent,
  defaults: TelemetryMetadataDefaults = {},
): MetricEvent {
  const categoryMetadata = extractCategoryMetadata(event);
  const metadata = {
    ...defaults,
    ...(event.metadata ?? {}),
    ...categoryMetadata,
  };

  if (Object.keys(metadata).length === 0) {
    return event;
  }

  return {
    ...event,
    metadata,
  };
}

function extractCategoryMetadata(event: MetricEvent): Record<string, unknown> {
  switch (event.category) {
    case "turn":
      return {
        classifier_ms: event.classifier_ms ?? null,
        intelligence_ms: event.intelligence_ms ?? null,
        context_ms: event.context_ms ?? null,
        total_events: event.total_events ?? null,
      };
    case "memory":
      return {
        results_count: event.results_count ?? null,
        embedding_generated: event.embedding_generated ?? null,
      };
    case "tool":
      return {
        board_rounds: event.board_rounds ?? null,
        participants: event.participants ?? null,
        budget_consumed: event.budget_consumed ?? null,
      };
    case "llm":
    case "system":
    default:
      return {};
  }
}
