import test from "node:test";
import assert from "node:assert/strict";
import { SCOPE_PARENT_COLUMNS } from "./scope.js";

test("scope parent chain uses org_id for projects and retains the deeper chain", () => {
  assert.deepEqual(SCOPE_PARENT_COLUMNS, [
    null,
    "org_id",
    "project_id",
    "initiative_id",
    "phase_id",
  ]);
});
