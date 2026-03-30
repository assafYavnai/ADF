import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { normalizeJsonText, writeBootstrapIngressIncident, writeBootstrapStartupIncident } from "./json-ingress.js";

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

test("writeBootstrapStartupIncident supports non-normalization startup failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "adf-json-ingress-test-"));
  try {
    const path = await writeBootstrapStartupIncident({
      toolRunRoot: root,
      requestPath: "C:/ADF/tools/agent-role-builder/tmp/request.json",
      stage: "shared_module_load",
      message: "module load failed",
      details: { component: "governance-runtime" },
    });

    const recorded = JSON.parse(await readFile(path, "utf-8")) as {
      normalization: unknown;
      details: { component?: string } | null;
    };
    assert.equal(recorded.normalization, null);
    assert.equal(recorded.details?.component, "governance-runtime");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
