/**
 * COO -> CTO Admission Packet Builder — KPI Tracking
 *
 * Tracks admission packet build outcomes for audit and observability.
 */

import type { BuildOutcome, KpiSnapshot, LatencyBuckets } from "./types.js";

export class AdmissionKpiTracker {
  private _built = 0;
  private _admitted = 0;
  private _deferred = 0;
  private _blocked = 0;
  private _missingInput = 0;
  private _dependencyBlocked = 0;
  private _scopeConflict = 0;
  private _latencies: number[] = [];
  private _completenessRates: number[] = [];
  private _parityCount = 0;
  private _partition: "production" | "proof";

  constructor(partition: "production" | "proof" = "production") {
    this._partition = partition;
  }

  recordBuild(
    outcome: BuildOutcome,
    latencyMs: number,
    completenessRate: number,
    opts: {
      dependencyBlocked?: boolean;
      scopeConflict?: boolean;
      validationErrors?: string[];
    } = {}
  ): void {
    this._latencies.push(latencyMs);
    this._completenessRates.push(completenessRate);

    switch (outcome) {
      case "admitted":
        this._built++;
        this._admitted++;
        this._parityCount++;
        break;
      case "deferred":
        this._built++;
        this._deferred++;
        this._parityCount++;
        break;
      case "blocked":
        this._built++;
        this._blocked++;
        this._parityCount++;
        break;
      case "build_failed":
        this._missingInput++;
        break;
    }

    if (opts.dependencyBlocked) this._dependencyBlocked++;
    if (opts.scopeConflict) this._scopeConflict++;
  }

  snapshot(): KpiSnapshot {
    const lastLatency = this._latencies.length > 0
      ? this._latencies[this._latencies.length - 1]
      : 0;
    const avgCompleteness = this._completenessRates.length > 0
      ? this._completenessRates.reduce((a, b) => a + b, 0) / this._completenessRates.length
      : 0;

    return {
      admission_packet_build_latency_ms: lastLatency,
      admission_packets_built_count: this._built,
      admission_packets_admitted_count: this._admitted,
      admission_packets_deferred_count: this._deferred,
      admission_packets_blocked_count: this._blocked,
      missing_required_input_count: this._missingInput,
      dependency_blocked_count: this._dependencyBlocked,
      scope_conflict_detected_count: this._scopeConflict,
      admission_source_metadata_completeness_rate: avgCompleteness,
      requirement_to_packet_parity_count: this._parityCount,
      partition: this._partition,
    };
  }

  latencyBuckets(): LatencyBuckets {
    return {
      over_1s: this._latencies.filter((l) => l > 1000).length,
      over_10s: this._latencies.filter((l) => l > 10000).length,
      over_60s: this._latencies.filter((l) => l > 60000).length,
    };
  }

  reset(): void {
    this._built = 0;
    this._admitted = 0;
    this._deferred = 0;
    this._blocked = 0;
    this._missingInput = 0;
    this._dependencyBlocked = 0;
    this._scopeConflict = 0;
    this._latencies = [];
    this._completenessRates = [];
    this._parityCount = 0;
  }
}
