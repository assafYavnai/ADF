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

test("shared-imports codex path stays aligned with temp-file prompt delivery", async () => {
  const localPath = fileURLToPath(new URL("./shared-imports.ts", import.meta.url));
  const canonicalPath = fileURLToPath(new URL("../../../shared/llm-invoker/invoker.ts", import.meta.url));

  const localSource = await readFile(localPath, "utf-8");
  const canonicalSource = await readFile(canonicalPath, "utf-8");

  const localBody = extractFunctionBody(localSource, "callCodex");
  const canonicalBody = extractFunctionBody(canonicalSource, "callCodex");

  const requiredMarkers = [
    "const promptFile = join(TEMP_DIR, `adf-codex-prompt-",
    "await writeFile(promptFile, params.prompt, \"utf-8\");",
    "const escapedPromptPath = promptFile.replace(/\\\\/g, \"/\");",
    "const codexArgs = args.map((a) => `\"${a.replace(/\"/g, '\\\\\"')}\"`).join(\" \");",
    "const shellCmd = `PROMPT=$(cat \"${escapedPromptPath}\") && codex ${codexArgs} \"$PROMPT\"`;",
    "const proc = spawn(\"bash\", [\"-c\", shellCmd], {",
    "await unlink(promptFile).catch(() => {});",
  ];

  for (const marker of requiredMarkers) {
    assert.match(canonicalBody, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(localBody, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(localBody, /proc\.stdin\?\.write\(params\.prompt\)/);
});
