# Grouped Shrinking Readiness Tests

This sandbox-only experiment family validates whether `grouped-shrinking` is ready to become the chosen pre-board review shape.

Focus:

- real role + contract pair bundle
- optional final full-sanity sweep
- forced checkpoint/resume path
- repeatability across 3 batches

All compared scenarios use:

- grouped-by-relevance review
- shrinking active rule set during normal cycles
- the same implementation-engine role pair fixture
- the same shared LLM invoker and `rules-compliance-enforcer`
