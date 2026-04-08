#!/usr/bin/env node

import assert from "node:assert/strict";

import { buildValidation } from "./launcher-route-telemetry-proof-lib.mjs";

function routeRow(overrides) {
  return {
    operation: "launcher_runtime_preflight",
    route_name: "runtime_preflight",
    route_stage: "route",
    step_name: "runtime-preflight",
    runtime_entry_surface: "explicit_runtime_preflight",
    control_plane_kind: "direct-bash",
    entrypoint: "adf.sh",
    success: true,
    ...overrides,
  };
}

function fullCoverageRows() {
  return [
    routeRow({}),
    routeRow({ control_plane_kind: "windows-cmd-trampoline", entrypoint: "adf.cmd" }),
    routeRow({
      operation: "launcher_install",
      route_name: "install",
      step_name: "install",
      runtime_entry_surface: "explicit_install",
    }),
    routeRow({
      operation: "launcher_install",
      route_name: "install",
      step_name: "install",
      runtime_entry_surface: "explicit_install",
      control_plane_kind: "windows-cmd-trampoline",
      entrypoint: "adf.cmd",
    }),
    routeRow({
      operation: "launcher_launch_preflight",
      route_name: "launch_preflight",
      step_name: "launch-preflight",
      runtime_entry_surface: "normal_launch_preflight",
    }),
    routeRow({
      operation: "launcher_launch_preflight",
      route_name: "launch_preflight",
      step_name: "launch-preflight",
      runtime_entry_surface: "normal_launch_preflight",
      control_plane_kind: "windows-cmd-trampoline",
      entrypoint: "adf.cmd",
    }),
    repairRow("install", "memory-engine repair", "explicit_install", "direct-bash", "adf.sh"),
    repairRow("install", "COO repair", "explicit_install", "direct-bash", "adf.sh"),
    repairRow("install", "install state", "explicit_install", "direct-bash", "adf.sh"),
    repairRow("launch_preflight", "memory-engine repair", "normal_launch_preflight", "direct-bash", "adf.sh"),
    repairRow("launch_preflight", "COO repair", "normal_launch_preflight", "direct-bash", "adf.sh"),
    repairRow("launch_preflight", "install state", "normal_launch_preflight", "direct-bash", "adf.sh"),
    repairRow("install", "memory-engine repair", "explicit_install", "windows-cmd-trampoline", "adf.cmd"),
    repairRow("install", "COO repair", "explicit_install", "windows-cmd-trampoline", "adf.cmd"),
    repairRow("install", "install state", "explicit_install", "windows-cmd-trampoline", "adf.cmd"),
    repairRow("launch_preflight", "memory-engine repair", "normal_launch_preflight", "windows-cmd-trampoline", "adf.cmd"),
    repairRow("launch_preflight", "COO repair", "normal_launch_preflight", "windows-cmd-trampoline", "adf.cmd"),
    repairRow("launch_preflight", "install state", "normal_launch_preflight", "windows-cmd-trampoline", "adf.cmd"),
  ];
}

function repairRow(routeName, stepName, entrySurface, controlPlaneKind, entrypoint) {
  return routeRow({
    operation: "launcher_repair_step",
    route_name: routeName,
    route_stage: "repair",
    step_name: stepName,
    runtime_entry_surface: entrySurface,
    control_plane_kind: controlPlaneKind,
    entrypoint,
  });
}

function testValidWindowsFrontdoorCoverage() {
  const validation = buildValidation(
    fullCoverageRows(),
    [{ telemetry_partition: "proof", total_events: 18 }],
    { expectCmdFrontdoor: true },
  );

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.invalid_partitions, []);
  assert.deepEqual(validation.missing_required_operations, []);
  assert.deepEqual(validation.missing_required_route_coverage, []);
  assert.deepEqual(validation.missing_required_repair_coverage, []);
}

function testMixedPartitionsFailClosed() {
  const validation = buildValidation(
    fullCoverageRows(),
    [
      { telemetry_partition: "proof", total_events: 18 },
      { telemetry_partition: "production", total_events: 1 },
    ],
    { expectCmdFrontdoor: true },
  );

  assert.equal(validation.valid, false);
  assert.deepEqual(validation.invalid_partitions, ["production"]);
}

function testMissingRepairCoverageFailsClosed() {
  const rows = fullCoverageRows().filter((row) =>
    !(row.operation === "launcher_repair_step"
      && row.route_name === "launch_preflight"
      && row.step_name === "install state"
      && row.control_plane_kind === "windows-cmd-trampoline"
      && row.entrypoint === "adf.cmd"),
  );

  const validation = buildValidation(
    rows,
    [{ telemetry_partition: "proof", total_events: rows.length }],
    { expectCmdFrontdoor: true },
  );

  assert.equal(validation.valid, false);
  assert.equal(validation.missing_required_repair_coverage.length, 1);
  assert.equal(validation.missing_required_repair_coverage[0].name, "cmd_launch_state");
}

function main() {
  testValidWindowsFrontdoorCoverage();
  testMixedPartitionsFailClosed();
  testMissingRepairCoverageFailsClosed();
  console.log("launcher-route-telemetry-proof tests passed");
}

main();
