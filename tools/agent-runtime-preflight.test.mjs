#!/usr/bin/env node

import assert from "node:assert/strict";

import { buildRuntimePreflightReport, renderRuntimePreflightHuman } from "./agent-runtime-preflight.mjs";

function createProcessRunner(responses) {
  return (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    return responses.get(key) ?? { status: 1, stdout: "", stderr: `missing mock for ${key}` };
  };
}

function createCommandLookup(entries) {
  return (command) => entries.get(command) ?? null;
}

function createPathExists(paths) {
  const normalized = new Set(
    Array.from(paths, (path) => String(path).replaceAll("\\", "/").toLowerCase()),
  );
  return (path) => normalized.has(String(path).replaceAll("\\", "/").toLowerCase());
}

function testHealthyWindowsBashWorkflow() {
  const repoRoot = "C:/ADF";
  const commandLookup = createCommandLookup(new Map([
    ["bash", "/usr/bin/bash"],
    ["node", "/c/Program Files/nodejs/node"],
    ["npm.cmd", "/c/Program Files/nodejs/npm.cmd"],
    ["npx.cmd", "/c/Program Files/nodejs/npx.cmd"],
    ["rg", "/c/Users/sufin/AppData/Local/Microsoft/WinGet/Links/rg"],
    ["pg_isready", "/usr/bin/pg_isready"],
  ]));
  const processRunner = createProcessRunner(new Map([
    ["/usr/bin/bash --version", { status: 0, stdout: "GNU bash, version 5.2.37(2)-release", stderr: "" }],
    ["pg_isready -h localhost -p 5432 -q", { status: 0, stdout: "", stderr: "" }],
  ]));
  const paths = new Set([
    "C:/ADF/COO/node_modules/.bin/tsx.cmd",
    "C:/ADF/COO/dist/COO/controller/memory-engine-client.js",
    "C:/ADF/components/memory-engine/dist/server.js",
    "C:/ADF/components/memory-engine/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js",
    "C:/ADF/tools/doctor-brain-connect-smoke.mjs",
    "C:/ADF/tools/doctor-brain-audit.mjs",
    "C:/ADF/.codex/runtime/install-state.json",
  ]);

  const report = buildRuntimePreflightReport({
    repoRoot,
    launchMode: "tsx-direct",
    platform: "win32",
    env: {
      MSYSTEM: "UCRT64",
      TERM_PROGRAM: "vscode",
      SHELL: "/usr/bin/bash",
      BASH: "/usr/bin/bash",
      ADF_CONTROL_PLANE_KIND: "direct-bash",
      ADF_ENTRYPOINT: "adf.sh",
    },
    cwd: "/c/ADF",
    commandLookup,
    processRunner,
    pathExists: createPathExists(paths),
    jsonReader: () => ({ completed_at: "2026-04-03T11:00:00.000Z" }),
  });

  assert.equal(report.host_os, "windows");
  assert.equal(report.workflow_shell, "bash");
  assert.equal(report.execution_shell, "bash");
  assert.equal(report.control_plane.kind, "direct-bash");
  assert.equal(report.control_plane.entrypoint, "adf.sh");
  assert.equal(report.shell_contract.approved_bash_runtime, "msys2-ucrt64");
  assert.equal(report.shell_contract.command_construction_mode, "windows-direct-bash-workflow");
  assert.equal(report.commands.npm.command_name, "npm.cmd");
  assert.equal(report.commands.npm.available, true);
  assert.equal(report.brain_mcp.availability_status, "available");
  assert.equal(report.brain_mcp.verification_status, "doctor_required");
  assert.equal(report.overall_status, "pass");
  assert.match(report.recommended_commands.runtime_preflight, /adf\.cmd --runtime-preflight --json/);
}

function testWindowsTrampolineControlPlane() {
  const report = buildRuntimePreflightReport({
    repoRoot: "C:/ADF",
    launchMode: "tsx-direct",
    platform: "win32",
    env: {
      MSYSTEM: "UCRT64",
      SHELL: "/usr/bin/bash",
      BASH: "/usr/bin/bash",
      ADF_CONTROL_PLANE_KIND: "windows-cmd-trampoline",
      ADF_ENTRYPOINT: "adf.cmd",
    },
    commandLookup: createCommandLookup(new Map([
      ["bash", "/usr/bin/bash"],
      ["node", "/c/Program Files/nodejs/node"],
      ["npm.cmd", "/c/Program Files/nodejs/npm.cmd"],
      ["npx.cmd", "/c/Program Files/nodejs/npx.cmd"],
      ["rg", "/c/Users/sufin/AppData/Local/Microsoft/WinGet/Links/rg"],
    ])),
    processRunner: createProcessRunner(new Map([
      ["/usr/bin/bash --version", { status: 0, stdout: "GNU bash, version 5.2.37(2)-release", stderr: "" }],
    ])),
    pathExists: createPathExists(new Set([
      "C:/ADF/COO/node_modules/.bin/tsx.cmd",
      "C:/ADF/COO/dist/COO/controller/memory-engine-client.js",
      "C:/ADF/components/memory-engine/dist/server.js",
      "C:/ADF/components/memory-engine/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js",
      "C:/ADF/tools/doctor-brain-connect-smoke.mjs",
      "C:/ADF/tools/doctor-brain-audit.mjs",
    ])),
    jsonReader: () => null,
  });

  assert.equal(report.control_plane.kind, "windows-cmd-trampoline");
  assert.equal(report.control_plane.entrypoint, "adf.cmd");
  assert.equal(report.control_plane.entrypoint_is_direct_bash, false);
  assert.equal(report.shell_contract.command_construction_mode, "windows-nonbash-control-plane-into-bash");
  assert.match(report.shell_contract.bash_write_style, /temporary \.sh script/i);
}

function testMissingArtifactsFail() {
  const repoRoot = "/repo";
  const commandLookup = createCommandLookup(new Map([
    ["bash", "/bin/bash"],
    ["node", "/usr/bin/node"],
    ["npm", "/usr/bin/npm"],
    ["npx", "/usr/bin/npx"],
    ["rg", "/usr/bin/rg"],
  ]));
  const processRunner = createProcessRunner(new Map([
    ["/bin/bash --version", { status: 0, stdout: "GNU bash, version 5.2.26(1)-release", stderr: "" }],
  ]));
  const report = buildRuntimePreflightReport({
    repoRoot,
    launchMode: "built",
    platform: "linux",
    env: {
      SHELL: "/bin/bash",
      BASH: "/bin/bash",
    },
    commandLookup,
    processRunner,
    pathExists: createPathExists(new Set()),
    jsonReader: () => null,
  });

  assert.equal(report.host_os, "linux");
  assert.equal(report.overall_status, "fail");
  assert.ok(report.checks.some((check) => check.name === "memory-engine dist" && check.status === "fail"));
  assert.equal(report.brain_mcp.availability_status, "blocked");
  assert.equal(report.brain_mcp.verification_status, "blocked");
  assert.ok(report.recommended_next_action.includes("./adf.sh --install"));
}

function testHumanRender() {
  const report = {
    checks: [
      { name: "workflow shell", status: "pass", detail: "ADF workflow shell is bash.", fix: null },
      { name: "control-plane entrypoint", status: "pass", detail: "Runtime preflight was entered through adf.cmd (windows-cmd-trampoline).", fix: null },
      { name: "Brain MCP route", status: "pass", detail: "Runtime preflight confirmed that the Brain MCP route artifacts are present.", fix: "Use ./adf.sh --doctor for full verification." },
    ],
    recommended_commands: {
      runtime_preflight: "./adf.sh --runtime-preflight --json",
      install: "./adf.sh --install",
      doctor: "./adf.sh --doctor",
      launch: "./adf.sh [flags] [-- <COO args>]",
    },
    recommended_next_action: "Runtime preflight found blocking issues. Run ./adf.sh --install.",
  };

  const rendered = renderRuntimePreflightHuman(report);

  assert.match(rendered, /\[PASS\] workflow shell/);
  assert.match(rendered, /\[PASS\] control-plane entrypoint/);
  assert.match(rendered, /\[PASS\] Brain MCP route/);
  assert.match(rendered, /runtime preflight: \.\/adf\.sh --runtime-preflight --json/);
  assert.match(rendered, /Next action: Runtime preflight found blocking issues/);
}

function main() {
  testHealthyWindowsBashWorkflow();
  testWindowsTrampolineControlPlane();
  testMissingArtifactsFail();
  testHumanRender();
  console.log("agent-runtime-preflight tests passed");
}

main();
