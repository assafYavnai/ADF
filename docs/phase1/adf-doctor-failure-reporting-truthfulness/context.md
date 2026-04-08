# adf-doctor-failure-reporting-truthfulness - Context

## Purpose
Make doctor failure reporting trustworthy enough to use as the authoritative runtime verification surface.

## Why It Exists

- current doctor output can report a failed step with `exit code 0`
- the root cause is in failure capture logic, not in the underlying failing command
- this defect weakens every later workflow that depends on doctor truth

## Key Constraints

- preserve success-path output
- keep the fix bounded to doctor failure capture and reporting
- prove the failure truth with a deterministic failing path
