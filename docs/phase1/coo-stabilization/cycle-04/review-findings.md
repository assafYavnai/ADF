# Cycle 04 Review Findings

Source: current cycle.

## Summary

The current review found that route correctness was largely closed, but two system-level route issues remained:

- the decision route still lost the structured-decision extractor identity
- the telemetry lifecycle could still wedge shutdown under a permanently failing sink

## Main Findings

1. COO decision logging still lost the LLM extraction provenance link on the durable decision record.
   - Extraction happened in the COO route, but the durable decision row only carried the write provenance.
2. Telemetry shutdown could still hang because failed batches were requeued forever and CLI shutdown blocked on an unbounded drain.
3. Historical evidence quality remained materially weaker than live route quality.
4. Daily residue still followed UTC day rather than the operator's local day.

## Review Conclusion

The fix needed to treat these as full-route issues:

- one continuous decision content-provenance chain
- bounded telemetry close with durable replay
- explicit partitioning between modern evidence and legacy evidence
