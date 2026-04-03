/**
 * Fixture: Empty sources — all families available but no items.
 * Tests that empty-state is distinguishable from missing-source.
 */

import type { RawThreadInput, RawRequirementInput, RawAdmissionInput, RawImplementPlanInput } from "../source-adapters.js";

export const threads: RawThreadInput[] = [];
export const requirements: RawRequirementInput[] = [];
export const admissions: RawAdmissionInput[] = [];
export const plans: RawImplementPlanInput[] = [];
