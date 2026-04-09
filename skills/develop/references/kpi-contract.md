# Develop KPI Contract

The Slice A `develop` skill freezes the KPI model even though capture expansion belongs to later slices.

## Timing Families

- total_elapsed
- preparation
- implementation
- verification
- review
- fix_cycles
- human_verification_wait
- invoker_approval_wait
- merge

## Count Families

- review_cycles
- fix_cycles
- verification_attempts
- verification_failures
- review_rejections
- human_rejections
- invoker_rejections

## Quality Families

- first_pass_review_approved
- first_pass_verification
- files_changed
- lines_added
- lines_removed
- defect_classes

## Outcome

- completed
- blocked
- failed
- cancelled

## Persistence Rule

- disk persistence is required at `.codex/develop/lanes/<lane-id>/kpi.json`
- Brain persistence is optional or best-effort
