import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RoleBuilderRequest } from "../schemas/request.js";
import { buildRoundArtifactRefs, buildRunArtifactRefs, buildRoundSnapshotPaths } from "./board.js";

function createMinimalRequest(roleSlug: string): RoleBuilderRequest {
  return { role_slug: roleSlug } as RoleBuilderRequest;
}

test("buildRunArtifactRefs uses round-local artifact and self-check snapshots", async () => {
  const roundDir = await mkdtemp(join(tmpdir(), "adf-board-artifact-refs-test-"));
  const request = createMinimalRequest("sample-role");

  try {
    const refs = await buildRunArtifactRefs("ignored-run-dir", roundDir, request);
    const roundSnapshots = buildRoundSnapshotPaths(roundDir, request);

    assert.equal(refs.artifact_markdown, roundSnapshots.artifactMarkdownPath.replace(/\\/g, "/"));
    assert.equal(refs.self_check, roundSnapshots.selfCheckPath.replace(/\\/g, "/"));
  } finally {
    await rm(roundDir, { recursive: true, force: true });
  }
});

test("buildRoundArtifactRefs uses round-local artifact and self-check snapshots", async () => {
  const roundDir = await mkdtemp(join(tmpdir(), "adf-board-artifact-refs-test-"));
  const request = createMinimalRequest("sample-role");

  try {
    const refs = await buildRoundArtifactRefs(roundDir, request);
    const roundSnapshots = buildRoundSnapshotPaths(roundDir, request);

    assert.equal(refs.artifact_markdown, roundSnapshots.artifactMarkdownPath.replace(/\\/g, "/"));
    assert.equal(refs.self_check, roundSnapshots.selfCheckPath.replace(/\\/g, "/"));
  } finally {
    await rm(roundDir, { recursive: true, force: true });
  }
});
