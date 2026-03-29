# Step 2g: Board Efficiency Optimization

Status: **planned**
Last updated: 2026-03-29

---

## Problem

The board currently makes 7 LLM calls per round. 3 of those are redundant — they ask a separate LLM to reconstruct information the implementer already has.

Current flow per round:
1. Compliance map generation (1 LLM call) — asks LLM "does the draft pass the rules?"
2. Fix items map generation (1 LLM call, round 1+) — asks LLM "what was fixed?"
3. Reviewer 1 (1 LLM call)
4. Reviewer 2 (1 LLM call)
5. Leader (1 LLM call)
6. Learning engine (1 LLM call)
7. Revision (1 LLM call) — produces updated draft

Calls 1, 2, and 7 should be ONE call. The implementer that revises the draft knows what it fixed and what rules it checked.

## Proposed Fix

### Round 0 (initial generation):
- `generateRoleMarkdown()` already produces the draft
- Merge compliance map generation INTO the generation call — the generator checks rules as it generates
- 1 call produces: draft + compliance map
- **Saves 1 LLM call**

### Round 1+ (revision):
- `reviseRoleMarkdown()` already produces the revised draft
- Merge compliance map + fix items map INTO the revision call — the reviser knows what it fixed and what rules it checked
- 1 call produces: revised draft + compliance map + fix items map
- **Saves 2 LLM calls**

### Result:
| | Before | After | Saved |
|---|---|---|---|
| Round 0 | 6 calls | 5 calls | 1 |
| Round 1+ | 7 calls | 5 calls | 2 |
| 3-round run | 20 calls | 15 calls | 25% |

### Implementation:

1. Update `generateRoleMarkdown()` prompt to also produce compliance map JSON
2. Update `reviseRoleMarkdown()` prompt to also produce compliance map + fix items map
3. Parse the combined response: split markdown from JSON artifacts
4. Remove standalone `generateComplianceMap()` and `generateFixItemsMap()` functions
5. Update `executeBoard()` to use the merged outputs

### Response format from implementer:

```
<draft>
...full markdown here...
</draft>

<compliance_map>
[{"rule_id":"ARB-001","status":"compliant","evidence_location":"<authority>","evidence_summary":"..."},...]
</compliance_map>

<fix_items_map>
[{"finding_group_id":"group-1","action":"accepted","summary":"...","evidence_location":"<scope>"},...]
</fix_items_map>
```

XML tags for separation — clean, parseable, no ambiguity between markdown content and JSON artifacts.

### Risk:
- Larger prompt = more tokens per call, but fewer calls overall = net savings
- Combined response parsing is more complex — need robust XML tag extraction
- If one artifact fails to parse, don't lose the others

### Dependencies:
- None — pure refactor of board.ts internals
- Does not change the review contract or reviewer/leader prompts
