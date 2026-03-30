import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runManagedProcess } from "./managed-process.js";

test("runManagedProcess returns stdout for a successful process", async () => {
  const result = await runManagedProcess({
    command: process.execPath,
    args: ["-e", "process.stdout.write('ok')"],
    timeoutMs: 5_000,
    label: "node-success",
  });

  assert.equal(result.stdout, "ok");
  assert.equal(result.exitCode, 0);
});

test("runManagedProcess kills a timed-out process tree", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "adf-managed-process-"));
  const markerPath = join(tempDir, "still-alive.txt");
  const childScriptPath = join(tempDir, "child.js");
  const parentScriptPath = join(tempDir, "parent.js");

  try {
    await writeFile(
      childScriptPath,
      [
        "const fs = require('node:fs');",
        `setTimeout(() => fs.writeFileSync(${JSON.stringify(markerPath)}, 'alive'), 1200);`,
        "setInterval(() => {}, 1000);",
      ].join("\n"),
      "utf-8"
    );

    await writeFile(
      parentScriptPath,
      [
        "const { spawn } = require('node:child_process');",
        `spawn(process.execPath, [${JSON.stringify(childScriptPath)}], { stdio: 'ignore' });`,
        "setInterval(() => {}, 1000);",
      ].join("\n"),
      "utf-8"
    );

    await assert.rejects(
      () =>
        runManagedProcess({
          command: process.execPath,
          args: [parentScriptPath],
          timeoutMs: 200,
          label: "node-timeout-tree",
        }),
      /timed out/i
    );

    await new Promise((resolve) => setTimeout(resolve, 1_600));
    await assert.rejects(() => access(markerPath, constants.F_OK), /ENOENT/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
