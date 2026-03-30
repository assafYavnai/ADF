import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RoleBuilderRequest } from "../schemas/request.js";
import {
  buildInitialSessionRegistry,
  buildLeaderSlotKey,
  buildReviewerSlotKey,
  updateSessionRegistrySlot,
  writeSessionRegistry,
} from "./session-registry.js";

function createRequest(): RoleBuilderRequest {
  return {
    job_id: "session-registry-test",
    role_slug: "agent-role-builder",
    runtime: {
      execution_mode: "live-roster-v1",
    },
    board_roster: {
      leader: {
        provider: "codex",
        model: "gpt-5.4",
        throttle: "high",
      },
      reviewers: [
        {
          provider: "claude",
          model: "sonnet",
          throttle: "medium",
        },
      ],
    },
  } as RoleBuilderRequest;
}

test("buildInitialSessionRegistry seeds loaded session handles by slot", () => {
  const request = createRequest();
  const registry = buildInitialSessionRegistry({
    request,
    startedAtIso: "2026-03-30T18:00:00.000Z",
    initialHandles: {
      [buildLeaderSlotKey(request.board_roster.leader)]: {
        provider: "codex",
        session_id: "019d401d-3bd7-7dd0-89c9-40b49398b1fb",
        source: "provider_returned",
      },
    },
  });

  assert.equal(registry.request_job_id, "session-registry-test");
  assert.equal(registry.slots["leader-codex"]?.last_status, "loaded");
  assert.equal(registry.slots["leader-codex"]?.handle?.session_id, "019d401d-3bd7-7dd0-89c9-40b49398b1fb");
  assert.equal(registry.slots["reviewer-0-claude"]?.handle, null);
});

test("updateSessionRegistrySlot records fresh or resumed session metadata", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "adf-session-registry-"));
  const registryPath = join(tempDir, "session-registry.json");
  const request = createRequest();

  try {
    await writeSessionRegistry(
      registryPath,
      buildInitialSessionRegistry({
        request,
        startedAtIso: "2026-03-30T18:00:00.000Z",
      })
    );

    await updateSessionRegistrySlot({
      sessionRegistryPath: registryPath,
      slotKey: buildReviewerSlotKey(0, request.board_roster.reviewers[0]!),
      round: 1,
      invocationId: "11111111-1111-4111-8111-111111111111",
      session: {
        handle: {
          provider: "claude",
          session_id: "53c67ac7-ccd7-43b5-9f92-525ad705f018",
          source: "caller_assigned",
        },
        status: "fresh",
      },
    });

    const stored = JSON.parse(await readFile(registryPath, "utf-8")) as {
      slots: Record<string, {
        handle: { session_id: string } | null;
        last_status: string | null;
        last_invocation_id: string | null;
        last_round: number | null;
      }>;
    };

    assert.equal(stored.slots["reviewer-0-claude"]?.handle?.session_id, "53c67ac7-ccd7-43b5-9f92-525ad705f018");
    assert.equal(stored.slots["reviewer-0-claude"]?.last_status, "fresh");
    assert.equal(stored.slots["reviewer-0-claude"]?.last_invocation_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(stored.slots["reviewer-0-claude"]?.last_round, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
