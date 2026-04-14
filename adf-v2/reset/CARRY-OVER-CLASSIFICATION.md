# Carry-Over Classification

Status: scaffold
Purpose: classify legacy/v1 repo surfaces before archive/delete/reset work begins

## Classification buckets

- certain carry-over
- probable carry-over
- reference-only
- not carried over
- undecided

## Initial known entries

| Surface | Current understanding | Notes |
|---|---|---|
| MCP Brain | certain/probable carry-over | likely substrate carry-over; exact architectural placement still needs wording |
| LangGraph | probable carry-over | candidate substrate/orchestration carry-over |
| Current CTO branch code | undecided | exploratory branch work; not canonical `main` truth |
| Legacy/v1 runtime/tooling surfaces on `main` | reference-only until classified | must not be treated as active v2 truth by default |

## Required next pass

This file should be expanded into a full ledger with at least:
- surface/component name
- location
- classification
- why
- required action
- decision owner
- status
