# 12-Factor Agents Summary and References

## Why it came up
We discussed that the current ADF problem is not just “bad prompts”.
It is architectural drift.
That led to adopting a 12-factor-agents style discipline from day 1.

## High-level takeaway from 12-factor-agents
The most relevant message for ADF is:

- good production “agents” are often **mostly software**
- with model calls at the right places
- strong ownership of prompts/context/state/control flow
- resumable execution
- smaller, focused agents
- externalized state instead of trusting long raw conversations forever

## The factors most relevant to ADF
These are the ones most aligned with our discussion:

1. **Own your prompts**
   - prompts are code / governed assets
   - not incidental strings hidden in sessions

2. **Own your context window**
   - context should be deliberately built
   - not accidental accumulation of long chat history

3. **Unify execution state and business state**
   - state should not live only inside the model session

4. **Launch / Pause / Resume with simple APIs**
   - workflows should support stop/resume cleanly

5. **Own your control flow**
   - orchestration belongs to the system, not to improvising model loops

6. **Small, Focused Agents**
   - bounded specialists are preferable to giant generalist drift

7. **Make your agent a stateless reducer**
   - this strongly informed our controller discussion

## How this influenced our ADF decisions
It reinforced these conclusions:

- the COO should stay the front end
- the system around it should become more deterministic
- truth should live in external artifacts/state
- each turn should be governed
- specialists should be bounded
- infrastructure and contracts should come before more behavior complexity

## Supporting external references

### 12-factor-agents
Repository / main reference:
https://github.com/humanlayer/12-factor-agents/tree/main

Key ideas visible in the project:
- mostly software, with LLM steps where they matter
- own your prompts
- own your context window
- unify execution state and business state
- launch/pause/resume
- small focused agents
- stateless reducer

### Anthropic — Building Effective Agents
Reference:
https://www.anthropic.com/engineering/building-effective-agents

Most relevant takeaway for ADF:
- start with the simplest pattern that works
- many systems need workflows and orchestrator-workers, not free-running agents everywhere

### Model Context Protocol SDKs
Reference:
https://modelcontextprotocol.io/docs/sdk

Relevant because we already discussed MCP as one of the future ADF building blocks.

### LangGraph Durable Execution
Reference:
https://docs.langchain.com/oss/javascript/langgraph/durable-execution

Relevant because it reinforces:
- checkpointed state
- durable execution
- resume semantics
- externalized workflow state

## Important caution
This package does **not** declare “ADF will literally adopt every 12-factor-agents recommendation verbatim.”
What it does declare is:
- the design philosophy is strongly compatible with that model
- ADF should take the architectural discipline seriously from day 1
