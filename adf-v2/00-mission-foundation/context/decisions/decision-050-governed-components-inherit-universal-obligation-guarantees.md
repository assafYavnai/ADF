# Decision D-050 - Governed components inherit universal obligation guarantees

Frozen decision:
- every component must accept and return authoritative JSON contracts
- terminal truth is `complete` or `blocked`; the system must not fake success
- execution happens only in project-governed isolated working areas, never in hidden agent-private areas
- repo and worktree state stay clean; meaningful CRUD batches trigger commit and push
- commit messages must be descriptive enough that a reader of history can understand the high-level change without scanning code first
- KPI truth must measure usage, effort and time, and cost, so bottlenecks can be improved from evidence over time
- everything is boxed, self-contained, standalone-testable, and connected only through contracts plus approved shared system tools
- components are workflow-agnostic building blocks that can be reused, reordered, repeated, and run in parallel
- everything must be concurrency-safe and parallel-safe
- components must be retry-safe and re-invocation-safe
- every run must leave durable audit truth for both success and failure
- contract evolution must be explicit and governed

Why:
- this locks the practical universal guarantee layer the system must satisfy before lower-level schema and workflow details are defined
- it keeps later component, role, and workflow work from drifting away from the approved fire-and-forget building-block model
- it gives implementation one explicit requirement baseline without forcing the CEO to design lower-level schemas
