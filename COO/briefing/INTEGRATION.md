# Executive Brief — Integration Note

## Current State
The executive brief read model is a standalone derived layer under `COO/briefing/`.
It is **not wired** into the active COO runtime, CLI, or controller.

## How to Wire Later

### 1. Source Facts Adapter
Create an adapter that reads from the COO runtime's actual data sources:
- `FileSystemThreadStore.list()` + `.get()` to enumerate active threads
- Extract `StateCommitEvent.data.openLoops` and `OnionWorkflowThreadState` from each thread
- Map `OnionState.open_decisions`, `FreezeStatus.blockers`, and lifecycle status into `BriefFeatureSnapshot` shape
- Optionally query the memory engine (Brain MCP) for additional context via `search_memory`

### 2. CLI Command
Add an `executive-brief` or `status` command to `COO/controller/cli.ts`:
```typescript
import { buildAndRenderWithKpi } from "../briefing/kpi.js";
// Collect facts from adapter, then:
const { rendered } = buildAndRenderWithKpi(facts);
console.log(rendered);
```

### 3. Controller Integration
Optionally trigger brief generation at startup or on a schedule within `COO/controller/loop.ts` config.

### 4. Telemetry Bridge
Wire `BriefBuildMetrics` from `kpi.ts` into the shared telemetry collector:
```typescript
import { emit } from "../../shared/telemetry/collector.js";
// After each build, emit metrics via the shared sink
```

### 5. Production/Proof Isolation
When wiring, set `sourcePartition: "production"` for real data and `"proof"` for test fixtures.
The parity mechanism will continue to work across both partitions.

## Dependencies for Wiring
- The KPI instrumentation lane (`coo-kpi-instrumentation`) must be stable and merged
- The controller must not be under active conflicting modification
- The adapter must handle missing/partial thread data gracefully

## What NOT to Change
The `COO/briefing/**` package should remain a pure derived layer.
Do not add write-back logic, persistence, or mutation of source data.
