# ADF v2 Vision

Status: first-pass reset direction
Last updated: 2026-04-14
Purpose: describe why the reset exists and what future it is meant to create

## Why the reset exists

ADF accumulated too many competing truths on `main`.
Legacy code, older vision documents, partial v2 drafts, and exploratory branch work made it too easy for a new session to infer the wrong architecture.

The practical failure behind the reset is trust.
The earlier path did not yet become a trustworthy fire-and-forget system for the CEO, and the repo started to mix lessons, experiments, and active truth into one surface.

The reset exists to restore a clean source of truth before more architecture or cleanup work continues.

## The future ADF v2 is trying to create

ADF v2 is trying to become a trustworthy software-building startup around the CEO.

In that future:
- the CEO stays high level
- CTO turns direction into shaped, bounded technical work
- DEV carries execution and delivery
- supporting infrastructure preserves state, memory, governance, and continuity without becoming the public identity of the system

The point is not to simulate a whole company early.
The point is to create the smallest startup that can carry CEO intent into disciplined delivery.

## Why CEO / CTO / DEV is the correct first model

CEO / CTO / DEV is the right reset-native starting ontology because it matches the real current job to be done.

It keeps the top layer:
- minimal
- business-facing
- understandable to a fresh agent or CEO
- narrow enough to freeze before wider architecture work

It also avoids reintroducing premature layers.
CTO can temporarily absorb shaping, architecture, sequencing, and admission work until the system proves a need for more specialization.

## How v2 differs from the older framing

The older framing leaned toward a broader virtual-company model and a COO-centered surface.
The reset does not deny that some of that work contained useful ideas.
It does reject using that broader frame as active truth for the restart.

Reset-native v2 differs in four ways:
- it starts as a clean restart, not as inherited architecture
- it treats legacy and older v2 material as source input, not canon
- it puts CEO / CTO / DEV at the top instead of COO-centered company layering
- it refuses to let infrastructure terms become the business ontology

## The role of infrastructure and substrate

Infrastructure still matters.
Brain/MCP, LangGraph, scripts, memory, runtime control, and other substrate candidates may carry over because they can preserve state, governance, and execution continuity.

But they are support layers, not the startup's top-level identity.
They should be evaluated for carry-over as infrastructure underneath the CEO / CTO / DEV model, not as replacements for that model.

## Direction test

The vision is working if the repo makes these truths obvious:
- what ADF v2 is
- what ADF v2 is not
- why the reset was necessary
- what must be decided next before cleanup or implementation expands
