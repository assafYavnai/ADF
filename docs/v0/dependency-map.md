# ADF Dependency Map

Status: adopted concept
Last updated: 2026-03-30

## Purpose

ADF needs a dependency map as a governed impact-analysis layer.

Its job is not only to say what depends on what.

Its real job is to answer:

- if this surface changes, who is affected?
- which downstream consumers are exposed?
- what is the blast radius?
- does this change require same-run consumer updates, a blocker, or an explicit open loop?

## Core Idea

The dependency map is a cached graph of exposed and consumed surfaces across the system.

At minimum, the model should capture:

- what each component, function, tool, or module **exposes**
- what each component, function, tool, or module **consumes**
- which changes create downstream risk
- which consumers must be checked before a change is accepted

This is a governance surface, not just documentation.

## Why ADF Needs It

ADF is being built as a Lego-like company and framework.

That only works if the system can detect when a local change is not actually local.

Examples:

- changing a shared module may affect multiple tools
- changing a governed role surface may affect the builder that consumes it
- changing a lane contract may affect later phases that rely on its handoff package
- changing a guide, rule surface, or schema may affect multiple reviewers, planners, or controllers

Without a dependency map, these become hidden chain reactions.

## What The Map Must Support

The dependency map should support impact analysis at more than one level.

### 1. System level

- which major components depend on which other components

### 2. Surface level

- which exact exposed surfaces are consumed by which downstream consumers

Examples:

- contracts
- schemas
- prompts
- guides
- scripts
- APIs
- runtime endpoints
- controller handoff files

### 3. Change-impact level

- if one surface changes, what consumers must be reviewed, updated, or blocked

This is the level that gives ADF real blast-radius awareness.

## Operating Rule

When a change touches an exposed surface, ADF should not rely on memory or intuition.

It should ask the dependency map:

1. who consumes this surface?
2. what kind of dependency is it?
3. will the change break, rename, weaken, or alter what consumers expect?
4. if yes, must those consumers be updated now, or must the change stop?

## Where It Must Be Used

The dependency map should be checked anywhere a change can create downstream risk.

At minimum:

- design
- planning
- review
- implementation
- finalization
- merger / integration

## Required Behaviors

The dependency-map layer should eventually support:

- cached dependency graph
- query by component
- query by exposed surface
- impact-target listing
- blast-radius reasoning
- refresh after meaningful structural change
- preservation of runtime-only edges that are not discoverable from file paths alone

## ADF Adoption Direction

ADF should adopt the ProjectBrain dependency-map concept, but adapt it to ADF's current architecture and terminology.

That means:

- the map should eventually understand ADF components, tools, modules, roles, contracts, and functions
- the map should be treated as a governance dependency layer
- function definitions and lane definitions should reference it where downstream impact matters
- dependency-impact checks should become part of governed build, review, implementation, and finalization flows

## Current Status In ADF

Current direction is adopted.

Current implementation status is still partial.

This concept is now part of ADF's documented architecture direction and should not be forgotten while Phase 1 function and builder work continues.
