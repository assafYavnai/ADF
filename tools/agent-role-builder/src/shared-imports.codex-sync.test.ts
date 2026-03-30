import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

function extractFunctionBody(source: string, functionName: string): string {
  const signature = `async function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Could not find ${functionName}()`);

  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `Could not find ${functionName}() body start`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart, index + 1);
      }
    }
  }

  throw new Error(`Could not extract ${functionName}() body`);
}

test("shared invoker source and built dist both keep temp-file codex prompt delivery", async () => {
  const sourcePath = fileURLToPath(new URL("../../../shared/llm-invoker/invoker.ts", import.meta.url));
  const distPath = fileURLToPath(new URL("../../../shared/dist/llm-invoker/invoker.js", import.meta.url));

  const sourceText = await readFile(sourcePath, "utf-8");
  const distText = await readFile(distPath, "utf-8");
  const sourceBody = extractFunctionBody(sourceText, "callCodex");

  for (const marker of [
    "const promptFile = join(TEMP_DIR, `adf-codex-prompt-",
    "await writeFile(promptFile, params.prompt, \"utf-8\");",
    "runCodexWithoutSession(params, promptFile, tmpFile)",
    "runCodexWithSession(params, promptFile, tmpFile, \"fresh\")",
  ]) {
    assert.match(sourceBody, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const marker of [
    "adf-codex-prompt-",
    "PROMPT=$(cat",
    "command: \"bash\"",
  ]) {
    assert.match(distText, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(sourceBody, /proc\.stdin\?\.write\(params\.prompt\)/);
  assert.doesNotMatch(distText, /args\.push\(params\.prompt\)/);
});

test("shared-imports stays a thin bridge over shared runtime modules", async () => {
  const bridgePath = fileURLToPath(new URL("./shared-imports.ts", import.meta.url));
  const bridgeText = await readFile(bridgePath, "utf-8");

  assert.match(bridgeText, /export \{\s*invoke\s*\} from "\.\.\/\.\.\/\.\.\/shared\/dist\/llm-invoker\/invoker\.js";/);
  assert.match(bridgeText, /export \{\s*Provider,\s*ProvenanceSchema,\s*createLLMProvenance,\s*createSystemProvenance,\s*\} from "\.\.\/\.\.\/\.\.\/shared\/dist\/provenance\/types\.js";/);
  assert.doesNotMatch(bridgeText, /async function callCodex/);
  assert.doesNotMatch(bridgeText, /function createSystemProvenance\(/);
});
