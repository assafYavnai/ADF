# Develop Artifact Templates

## `implement-plan-contract.md`

Required headings in this exact order:

1. `1. Implementation Objective`
2. `2. Slice Scope`
3. `3. Required Deliverables`
4. `4. Allowed Edits`
5. `5. Forbidden Edits`
6. `6. Acceptance Gates`
7. `7. Observability / Audit`
8. `8. Dependencies / Constraints`
9. `9. Non-Goals`
10. `10. Source Authorities`

Validation rules:

- each heading must appear exactly once
- headings must appear in the listed order
- fenced code blocks do not count as heading locations
- the Acceptance Gates section must include the KPI and compatibility labels frozen by the governed implementation contract

## `context.md`

Required content blocks:

- phase metadata: `phase_number`, `feature_slug`, `base_branch`, `feature_branch`
- task summary
- authoritative sources
- constraints
- expected touch points

Validation rules:

- the file must exist
- the file must not be empty
- the content must point at the current slice authorities rather than a generic placeholder
