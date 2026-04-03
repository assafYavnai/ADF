import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createThread } from "../controller/thread.js";
import { assembleContext, buildPrompt } from "./context-engineer.js";

test("assembleContext surfaces brain search failures explicitly", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-context-engineer-test-"));

  try {
    const context = await assembleContext(createThread("assafyavnai/shippingagent"), "what is the status?", {
      projectRoot: process.cwd(),
      promptsDir: tempRoot,
      memoryDir: tempRoot,
      scopePath: "assafyavnai/shippingagent",
      brainSearch: async () => {
        throw new Error("brain offline");
      },
    });

    assert.match(context.knowledgeContext, /Brain search failed: brain offline/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("assembleContext requests scoped reviewed governance memory before truncation", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-context-engineer-test-"));
  let capturedOptions: Record<string, unknown> | undefined;
  const thread = createThread("assafyavnai/shippingagent");

  try {
    const context = await assembleContext(thread, "what did we decide?", {
      projectRoot: process.cwd(),
      promptsDir: tempRoot,
      memoryDir: tempRoot,
      scopePath: "assafyavnai/shippingagent",
      brainSearch: async (_query, _scopePath, _prov, options) => {
        capturedOptions = options;
        return [
          {
            id: "rule-1",
            content_type: "rule",
            trust_level: "reviewed",
            preview: "Use governed requirement freeze.",
            context_priority: "p0",
            score: 0.8,
          },
        ];
      },
    });

    assert.deepEqual(capturedOptions, {
      contentTypes: [
        "decision",
        "requirement",
        "convention",
        "rule",
        "role",
        "setting",
        "finding",
        "open_loop",
      ],
      trustLevels: ["reviewed", "locked"],
      maxResults: 10,
      telemetryContext: {
        thread_id: thread.id,
        scope_path: "assafyavnai/shippingagent",
        workflow: "direct_coo_response",
        route_stage: "context_engineer",
        step_name: "load_knowledge",
      },
    });
    assert.match(context.knowledgeContext, /trust="reviewed"/);
    assert.match(context.knowledgeContext, /Use governed requirement freeze/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("buildPrompt makes the active Brain scope explicit to the COO", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "adf-context-engineer-test-"));

  try {
    const context = await assembleContext(createThread("assafyavnai/shippingagent"), "what scope are we in?", {
      projectRoot: "C:/ADF",
      promptsDir: tempRoot,
      memoryDir: tempRoot,
      scopePath: "assafyavnai/shippingagent",
    });

    const prompt = buildPrompt(context);
    assert.match(prompt, /<active_scope>/);
    assert.match(prompt, /Brain scope path for this thread: assafyavnai\/shippingagent/);
    assert.match(prompt, /answer with the Brain scope path above/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
