# Decision D-039 - Completion Requires Return Into The Production Tree

Frozen decision:
- delivery is not complete while the result remains only in a side worktree, temporary branch state, or other pre-production-tree holding state
- completion requires that the requested artifact has actually returned into the production tree

What that means:
- a validated pre-merge state is not yet full completion
- delivery remains incomplete until the result is back in the real production codebase
- temporary implementation state must not be certified upward as terminal completion

Why this was accepted:
- otherwise the result remains pre-terminal
- pre-production-tree state still leaves doubt about whether delivery has truly finished
- this keeps completion aligned with the true CEO-facing return boundary
