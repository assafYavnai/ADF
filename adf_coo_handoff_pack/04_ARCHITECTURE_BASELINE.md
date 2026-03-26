# Architecture Baseline

## Global baseline for new ADF
These are the baseline technology decisions for the future ADF architecture.

### Runtime
- **Node.js + TypeScript**

### Process orchestration
- **`node:child_process`**

### Schemas / validation
- **JSON Schema + Zod**

### PowerShell / shell
- allowed only for:
  - leaf adapters
  - existing Windows-centric tools
  - migration shims where necessary

### Python
- allowed for specialist tools
- **not** for the controller

## Why this baseline exists
This is meant to solve several issues at once:

- OS-agnostic future
- production-quality controller runtime
- clear process orchestration story
- structured contracts and validation
- isolation of Windows-specific behavior into leaf layers
- better long-term maintainability than continuing to grow ADF as a scattered mix of PowerShell-first governance

## What this means in practice
New foundational infrastructure should prefer:
- TypeScript
- explicit contracts
- explicit schemas
- explicit runtime artifacts
- explicit build outputs
- explicit test outputs

PowerShell should stay where it is already strong:
- Windows integration
- existing operational tools
- migration bridges

## Controller implication
The controller should be built in TypeScript / Node.
It can still invoke:
- existing PowerShell tools
- specialist runtimes
- provider CLIs

but the controller itself should not be PowerShell.

## Migration implication
This is not a demand to rewrite everything immediately.
It is the baseline for:
- new core infrastructure
- migrated core infrastructure
- new controller/control-plane layers
- new component contracts
