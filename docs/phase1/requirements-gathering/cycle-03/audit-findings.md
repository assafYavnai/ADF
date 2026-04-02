1. Findings

1. failure class: proof-only invoker seam is live on the production CLI bootstrap path

broken route invariant in one sentence: the live CLI bootstrap must not accept a proof-only LLM stub path that can replace real classifier/onion invocation in the same executable used for normal COO operation.

exact route: CLI bootstrap -> `createTestProofInvokerFromEnv` reads `ADF_COO_TEST_PARSER_UPDATES_FILE` -> `config.invokeLLM` is replaced with the proof stub -> classifier and onion turn parsing run on canned responses -> thread, persistence, and telemetry are recorded as if they came from the live route.

exact file/line references: [cli.ts#L32](/C:/ADF/COO/controller/cli.ts#L32), [cli.ts#L34](/C:/ADF/COO/controller/cli.ts#L34), [cli.ts#L146](/C:/ADF/COO/controller/cli.ts#L146), [cli.ts#L156](/C:/ADF/COO/controller/cli.ts#L156), [cli.ts#L208](/C:/ADF/COO/controller/cli.ts#L208), [cli.ts#L223](/C:/ADF/COO/controller/cli.ts#L223), [onion-route.runtime-proof.ts#L847](/C:/ADF/tests/integration/onion-route.runtime-proof.ts#L847), [onion-route.runtime-proof.ts#L859](/C:/ADF/tests/integration/onion-route.runtime-proof.ts#L859), [report.json#L3](/C:/ADF/tests/integration/artifacts/onion-route-proof/report.json#L3), [e7e2e92a-10b6-43f5-b4b0-d049dc47bc78.txt#L31](/C:/ADF/tests/integration/artifacts/onion-route-proof/cli-runtime/threads/e7e2e92a-10b6-43f5-b4b0-d049dc47bc78.txt#L31).

concrete operational impact: any contaminated shell or automation environment that carries `ADF_COO_TEST_PARSER_UPDATES_FILE` can silently divert the CEO-facing CLI off the real LLM path and still persist thread state, telemetry, and potentially governed requirement artifacts under a real scope, which breaks the route’s truthfulness guarantee.

sweep scope: all CLI/bootstrap-only proof seams, any other env-driven invoker overrides, proof wrappers that currently depend on the main CLI binary, and docs/proof claims that describe the route as live without distinguishing bootstrap proof from proof-mode invocation injection.

closure proof: the production CLI must ignore or reject `ADF_COO_TEST_PARSER_UPDATES_FILE` unless an explicit test-only mode is enabled; add a negative runtime check proving the normal CLI cannot be diverted by that env var, and a separate positive proof path showing the deterministic CLI proof still works through a dedicated test-only wrapper or guarded proof mode without using the ordinary live bootstrap path.

status: policy edge case

2. Conceptual Root Cause

1. missing production-vs-proof bootstrap isolation contract

the cycle-02 work closed the onion, persistence, recovery, and supersession route contracts, but the CLI proof seam was implemented inside the same bootstrap path that serves live COO turns. The missing route-level invariant is: proof-only deterministic invoker injection must be isolated from normal CLI operation, not merely hidden behind a test-named environment variable.

3. High-Level View Of System Routes That Still Need Work

1. proof harness bootstrap isolation for the live COO CLI route

why endpoint-only fixes will fail: changing only the report wording leaves the live seam active, while deleting the seam from `cli.ts` without replacing the proof entry breaks the current CLI-route proof generation.

the minimal layers that must change to close the route: CLI bootstrap env handling, the CLI proof harness entry in [onion-route.runtime-proof.ts](/C:/ADF/tests/integration/onion-route.runtime-proof.ts), and the route/proof documentation so the execution path and proof mode are explicitly separated.

explicit non-goals, so scope does not widen into general refactoring: no controller-loop redesign, no onion workflow redesign, no telemetry schema redesign, and no broad test-framework rewrite.

what done looks like operationally: the standard CLI always uses the real invoker path in normal operation, proof-mode stub injection is available only through an explicit isolated test path, and the generated proof artifacts still demonstrate CLI bootstrap, routing, persistence, recovery, and telemetry without leaving a live proof seam in production bootstrap.
