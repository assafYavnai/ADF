# Merge-Queue Prompt Templates

`merge-queue` is deterministic helper-driven orchestration.
It does not require long-form worker prompts.

Output discipline:

- show concise JSON-backed status for help, settings, status, enqueue, and process-next
- do not claim merge success without a concrete merge commit SHA and push evidence
- do not claim feature completion unless implement-plan state was updated successfully
