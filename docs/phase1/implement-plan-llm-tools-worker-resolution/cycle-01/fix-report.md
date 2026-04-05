1. Failure Classes Closed
None. Both lanes approved.
2. Route Contracts Now Enforced
Preflight -> setup.json llm_tools -> resolveWorkerSelection available_workers -> prepare output -> orchestrator can pick.
3. Files Changed And Why
- implement-plan-setup-helper.mjs: detectLlmToolsViaPreflight(), stores in setup
- implement-plan-helper.mjs: resolveWorkerSelection returns available_workers, prepare output surfaces it
- implement-plan workflow-contract.md: llm_tools field docs, spawn pattern section
- review-cycle-setup-helper.mjs: same preflight integration
- review-cycle workflow-contract.md: same spawn pattern
4. Sibling Sites Checked
Both skill helpers updated consistently.
5. Proof Of Closure
Syntax passes, setup produces llm_tools, prepare shows available_workers.
6. Remaining Debt / Non-Goals
None.
7. Next Cycle Starting Point
None.
