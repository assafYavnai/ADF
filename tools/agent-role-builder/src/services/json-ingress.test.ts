import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { normalizeJsonText, writeBootstrapIngressIncident } from "./json-ingress.js";

test("writeBootstrapIngressIncident writes a single .json suffix for .json requests", async () => {
  const root = await mkdtemp(join(tmpdir(), "adf-json-ingress-test-"));
  try {
    const path = await writeBootstrapIngressIncident({
      toolRunRoot: root,
      requestPath: "C:/ADF/tools/agent-role-builder/tmp/request.json",
      stage: "request_json_parse",
      meta: normalizeJsonText("\ufeff{}").meta,
      message: "parse failed",
    });

    assert.equal(basename(path), basename(path).replace(".json.json", ".json"));
    assert.match(basename(path), /^.+-request\.json$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeBootstrapIngressIncident preserves names without an extension", async () => {
  const root = await mkdtemp(join(tmpdir(), "adf-json-ingress-test-"));
  try {
    const path = await writeBootstrapIngressIncident({
      toolRunRoot: root,
      requestPath: "C:/ADF/tools/agent-role-builder/tmp/request-without-extension",
      stage: "request_json_parse",
      meta: normalizeJsonText("{}").meta,
      message: "parse failed",
    });

    assert.match(basename(path), /^.+-request-without-extension\.json$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeBootstrapIngressIncident strips only the final extension from multi-dot names", async () => {
  const root = await mkdtemp(join(tmpdir(), "adf-json-ingress-test-"));
  try {
    const path = await writeBootstrapIngressIncident({
      toolRunRoot: root,
      requestPath: "C:/ADF/tools/agent-role-builder/tmp/request.payload.json",
      stage: "request_json_parse",
      meta: normalizeJsonText("{}").meta,
      message: "parse failed",
    });

    assert.match(basename(path), /^.+-request\.payload\.json$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
