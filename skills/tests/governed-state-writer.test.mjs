#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { governedStateWrite, readJson, pathExists } from "../governed-feature-runtime.mjs";

const testRoot = join(
  process.env.TEMP || process.env.TMPDIR || "/tmp",
  "gsw-test-" + randomUUID()
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

async function runTest(name, fn) {
  const testDir = join(testRoot, name.replace(/\s+/g, "-"));
  await mkdir(testDir, { recursive: true });
  try {
    await fn(testDir);
    passed += 1;
    process.stdout.write("PASS: " + name + "\n");
  } catch (error) {
    failed += 1;
    process.stderr.write("FAIL: " + name + "\n  " + (error.stack ?? error.message ?? String(error)) + "\n");
  }
}

// Test 1: Basic committed write with revision tracking
await runTest("basic committed write with revision tracking", async (dir) => {
  const statePath = join(dir, "state.json");
  const slug = "test-feature-basic";

  const result1 = await governedStateWrite({
    statePath,
    featureSlug: slug,
    mutator: () => ({ feature_status: "active", step: 1 }),
    skipLock: true
  });

  assert(result1.status === "committed", "first write should be committed");
  assert(result1.revision === 1, "first revision should be 1");
  assert(typeof result1.write_id === "string" && result1.write_id.startsWith("gsw-"), "write_id should start with gsw-");

  const written1 = await readJson(statePath);
  assert(written1.__gsw_revision === 1, "file revision should be 1");
  assert(written1.__gsw_write_id === result1.write_id, "file write_id should match");
  assert(typeof written1.__gsw_timestamp === "string", "timestamp should be a string");
  assert(written1.feature_status === "active", "feature_status preserved");

  const result2 = await governedStateWrite({
    statePath,
    featureSlug: slug,
    mutator: (current) => ({ ...current, step: 2 }),
    skipLock: true
  });

  assert(result2.revision === 2, "second revision should be 2");
  const written2 = await readJson(statePath);
  assert(written2.__gsw_revision === 2, "file revision should be 2 after second write");
  assert(written2.step === 2, "step should be updated to 2");
});

// Test 2: Malformed state fail-closed behavior
await runTest("malformed state fail-closed behavior", async (dir) => {
  const statePath = join(dir, "state.json");
  const slug = "test-feature-malformed";

  // Write garbage to the state file
  await mkdir(dir, { recursive: true });
  await writeFile(statePath, "{{NOT VALID JSON!!", "utf8");

  let caught = false;
  try {
    await governedStateWrite({
      statePath,
      featureSlug: slug,
      mutator: (current) => current ?? { fallback: true },
      skipLock: true
    });
  } catch (error) {
    caught = true;
    assert(error instanceof SyntaxError || error.message.includes("JSON"), "should be a JSON parse error");
  }
  assert(caught, "should have thrown on malformed state");

  // Verify the malformed file is unchanged (no silent overwrite)
  const raw = await readFile(statePath, "utf8");
  assert(raw === "{{NOT VALID JSON!!", "malformed file should not have been overwritten");
});

// Test 3: Cross-feature isolation
await runTest("cross-feature isolation", async (dir) => {
  const pathA = join(dir, "feature-a", "state.json");
  const pathB = join(dir, "feature-b", "state.json");

  const [resultA, resultB] = await Promise.all([
    governedStateWrite({
      statePath: pathA,
      featureSlug: "feature-a",
      mutator: () => ({ name: "a" }),
      skipLock: false
    }),
    governedStateWrite({
      statePath: pathB,
      featureSlug: "feature-b",
      mutator: () => ({ name: "b" }),
      skipLock: false
    })
  ]);

  assert(resultA.status === "committed", "feature-a committed");
  assert(resultB.status === "committed", "feature-b committed");
  assert(resultA.revision === 1, "feature-a revision 1");
  assert(resultB.revision === 1, "feature-b revision 1");

  const stateA = await readJson(pathA);
  const stateB = await readJson(pathB);
  assert(stateA.name === "a", "feature-a state correct");
  assert(stateB.name === "b", "feature-b state correct");
});

// Test 4: Same-feature serialization (concurrent writes)
await runTest("same-feature serialization concurrent writes", async (dir) => {
  const statePath = join(dir, "state.json");
  const slug = "test-feature-serial";

  // Seed state
  await governedStateWrite({
    statePath,
    featureSlug: slug,
    mutator: () => ({ counter: 0 }),
    skipLock: false
  });

  // Launch 5 concurrent writes to the same feature
  const writes = [];
  for (let i = 1; i <= 5; i++) {
    writes.push(
      governedStateWrite({
        statePath,
        featureSlug: slug,
        mutator: (current) => ({ ...current, counter: (current?.counter ?? 0) + 1 }),
        skipLock: false
      })
    );
  }

  const results = await Promise.all(writes);

  // All should succeed
  for (const r of results) {
    assert(r.status === "committed", "each concurrent write committed");
  }

  // Revisions should be sequential (2..6 since seed was 1)
  const revisions = results.map((r) => r.revision).sort((a, b) => a - b);
  assert(revisions[0] === 2, "first concurrent revision is 2");
  assert(revisions[4] === 6, "last concurrent revision is 6");
  for (let i = 1; i < revisions.length; i++) {
    assert(revisions[i] === revisions[i - 1] + 1, "revisions are sequential");
  }

  // Final counter should be 5
  const finalState = await readJson(statePath);
  assert(finalState.counter === 5, "counter should be 5 after 5 increments, got " + finalState.counter);
});

// Test 5: Failed mutator hard-stop
await runTest("failed mutator hard-stop", async (dir) => {
  const statePath = join(dir, "state.json");
  const slug = "test-feature-fail";

  // Seed initial state
  await governedStateWrite({
    statePath,
    featureSlug: slug,
    mutator: () => ({ value: "original" }),
    skipLock: true
  });

  // Mutator that throws
  let caught = false;
  try {
    await governedStateWrite({
      statePath,
      featureSlug: slug,
      mutator: () => { throw new Error("intentional failure"); },
      skipLock: true
    });
  } catch (error) {
    caught = true;
    assert(error.message === "intentional failure", "should propagate mutator error");
  }
  assert(caught, "should have thrown");

  // State should be unchanged
  const state = await readJson(statePath);
  assert(state.value === "original", "state should be unchanged after failed mutator");
  assert(state.__gsw_revision === 1, "revision should still be 1");
});

// Test 6: skipLock mode
await runTest("skipLock mode writes atomically without lock", async (dir) => {
  const statePath = join(dir, "state.json");
  const slug = "test-feature-skiplock";

  const result = await governedStateWrite({
    statePath,
    featureSlug: slug,
    mutator: () => ({ mode: "skipLock" }),
    skipLock: true
  });

  assert(result.status === "committed", "skipLock write committed");
  assert(result.revision === 1, "revision is 1");

  const state = await readJson(statePath);
  assert(state.mode === "skipLock", "state written correctly");
  assert(state.__gsw_revision === 1, "revision metadata present");

  // Verify no lock directory was created
  const lockDirExists = await pathExists(join(dir, ".gsw-locks"));
  assert(!lockDirExists, "lock directory should not exist when skipLock is true");
});

// Cleanup
await rm(testRoot, { recursive: true, force: true });

process.stdout.write("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) {
  process.exit(1);
}
