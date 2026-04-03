# Human-Facing Report Rule

Date: 2026-04-03
Scope: `assafyavnai/adf`
Intended trust level: `reviewed` after CEO confirmation

## Rule

- All user-facing reports must be written for fast human scanning.
- Do not deliver reports as a dense blob of text.
- Reports must use a clear structure with short sections and concise bullets when the content is list-shaped.
- Reports must surface the most important outcome first.
- Reports must clearly separate:
  - current status
  - key findings or risks
  - recommended next actions
- Reports should prefer short executive wording over long narrative dumps.
- Long evidence should be referenced, not pasted inline, unless the exact text is required.
- A report that is technically correct but hard for a human to scan is not complete.

## Why

- ADF reports are used for decision-making, review, and execution control.
- Dense prose slows review, hides blockers, and makes follow-up action less reliable.
- Human-facing structure is part of report quality, not optional polish.

## Session Note

- The `project-brain` MCP tools were not exposed in this Codex runtime, so this rule is captured here as repo-backed fallback authority for later Brain ingestion.

## Brain Rule Payload

```json
{
  "surface": "rules_manage",
  "arguments": {
    "action": "create",
    "scope": "assafyavnai/adf",
    "title": "Human-Facing Report Formatting Rule",
    "tags": [
      "reporting",
      "communication",
      "ux",
      "governance"
    ],
    "body": {
      "rule_text": "All user-facing reports must be human-facing and easy to scan. Reports must not be delivered as dense blobs of text. They must lead with the most important outcome, use clear structure, separate status from findings and next actions, and optimize for fast human comprehension.",
      "requirements": [
        "Lead with the most important outcome.",
        "Use short sections and concise bullets when appropriate.",
        "Separate current status, findings or risks, and next actions.",
        "Prefer concise executive wording over long narrative dumps.",
        "Reference long evidence instead of pasting it inline unless exact text is required."
      ],
      "enforcement_expectations": [
        "A report that is difficult for a human to scan is not complete.",
        "Formatting quality is part of report quality, not optional polish."
      ]
    }
  }
}
```
