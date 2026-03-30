/**
 * Thin bridge to canonical shared runtime modules.
 *
 * This file intentionally keeps only the local telemetry buffer shim that the
 * current agent-role-builder run-telemetry path still reads directly.
 */

export {
  Provider,
  ProvenanceSchema,
  createLLMProvenance,
  createSystemProvenance,
} from "../../../shared/dist/provenance/types.js";
export type { Provenance } from "../../../shared/dist/provenance/types.js";

export { invoke } from "../../../shared/dist/llm-invoker/invoker.js";
export type { InvocationParams, InvocationResult } from "../../../shared/dist/llm-invoker/types.js";

import type { MetricEvent } from "../../../shared/dist/telemetry/types.js";

export type TelemetryEvent = MetricEvent;

const telemetryBuffer: TelemetryEvent[] = [];

export function emit(event: TelemetryEvent): void {
  telemetryBuffer.push(event);
}

export function getTelemetryBuffer(): TelemetryEvent[] {
  return [...telemetryBuffer];
}

export function clearTelemetryBuffer(): void {
  telemetryBuffer.length = 0;
}
