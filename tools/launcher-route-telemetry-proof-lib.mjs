const REQUIRED_OPERATIONS = [
  "launcher_runtime_preflight",
  "launcher_install",
  "launcher_launch_preflight",
  "launcher_repair_step",
];

const DIRECT_BASH_ROUTE_COVERAGE = [
  routeSpec("direct_bash_runtime_preflight", "launcher_runtime_preflight", "runtime_preflight", "route", "runtime-preflight", "explicit_runtime_preflight", "direct-bash", "adf.sh"),
  routeSpec("direct_bash_install", "launcher_install", "install", "route", "install", "explicit_install", "direct-bash", "adf.sh"),
  routeSpec("direct_bash_launch_preflight", "launcher_launch_preflight", "launch_preflight", "route", "launch-preflight", "normal_launch_preflight", "direct-bash", "adf.sh"),
];

const DIRECT_BASH_REPAIR_COVERAGE = [
  repairSpec("direct_bash_install_memory_engine", "install", "memory-engine repair", "explicit_install", "direct-bash", "adf.sh"),
  repairSpec("direct_bash_install_coo", "install", "COO repair", "explicit_install", "direct-bash", "adf.sh"),
  repairSpec("direct_bash_install_state", "install", "install state", "explicit_install", "direct-bash", "adf.sh"),
  repairSpec("direct_bash_launch_memory_engine", "launch_preflight", "memory-engine repair", "normal_launch_preflight", "direct-bash", "adf.sh"),
  repairSpec("direct_bash_launch_coo", "launch_preflight", "COO repair", "normal_launch_preflight", "direct-bash", "adf.sh"),
  repairSpec("direct_bash_launch_state", "launch_preflight", "install state", "normal_launch_preflight", "direct-bash", "adf.sh"),
];

const CMD_FRONTDOOR_ROUTE_COVERAGE = [
  routeSpec("cmd_runtime_preflight", "launcher_runtime_preflight", "runtime_preflight", "route", "runtime-preflight", "explicit_runtime_preflight", "windows-cmd-trampoline", "adf.cmd"),
  routeSpec("cmd_install", "launcher_install", "install", "route", "install", "explicit_install", "windows-cmd-trampoline", "adf.cmd"),
  routeSpec("cmd_launch_preflight", "launcher_launch_preflight", "launch_preflight", "route", "launch-preflight", "normal_launch_preflight", "windows-cmd-trampoline", "adf.cmd"),
];

const CMD_FRONTDOOR_REPAIR_COVERAGE = [
  repairSpec("cmd_install_memory_engine", "install", "memory-engine repair", "explicit_install", "windows-cmd-trampoline", "adf.cmd"),
  repairSpec("cmd_install_coo", "install", "COO repair", "explicit_install", "windows-cmd-trampoline", "adf.cmd"),
  repairSpec("cmd_install_state", "install", "install state", "explicit_install", "windows-cmd-trampoline", "adf.cmd"),
  repairSpec("cmd_launch_memory_engine", "launch_preflight", "memory-engine repair", "normal_launch_preflight", "windows-cmd-trampoline", "adf.cmd"),
  repairSpec("cmd_launch_coo", "launch_preflight", "COO repair", "normal_launch_preflight", "windows-cmd-trampoline", "adf.cmd"),
  repairSpec("cmd_launch_state", "launch_preflight", "install state", "normal_launch_preflight", "windows-cmd-trampoline", "adf.cmd"),
];

export function summarizeOperations(rows) {
  const summaries = new Map();

  for (const row of rows) {
    if (!summaries.has(row.operation)) {
      summaries.set(row.operation, {
        operation: row.operation,
        total_events: 0,
        success_count: 0,
        failure_count: 0,
        route_stages: new Set(),
        step_names: new Set(),
      });
    }

    const summary = summaries.get(row.operation);
    summary.total_events += 1;
    summary.success_count += row.success ? 1 : 0;
    summary.failure_count += row.success ? 0 : 1;
    if (row.route_stage) {
      summary.route_stages.add(row.route_stage);
    }
    if (row.step_name) {
      summary.step_names.add(row.step_name);
    }
  }

  return Array.from(summaries.values()).map((summary) => ({
    operation: summary.operation,
    total_events: summary.total_events,
    success_count: summary.success_count,
    failure_count: summary.failure_count,
    route_stages: Array.from(summary.route_stages.values()),
    step_names: Array.from(summary.step_names.values()),
  }));
}

export function buildValidation(rows, partitionCounts, options = {}) {
  const expectCmdFrontdoor = options.expectCmdFrontdoor === true;
  const operationSummary = summarizeOperations(rows);
  const missingRequiredOperations = REQUIRED_OPERATIONS.filter((operation) =>
    !operationSummary.some((entry) => entry.operation === operation),
  );

  const invalidPartitions = partitionCounts
    .filter((entry) => String(entry.telemetry_partition ?? "") !== "proof")
    .map((entry) => String(entry.telemetry_partition ?? ""));

  const hasProofRows = partitionCounts.some((entry) => String(entry.telemetry_partition ?? "") === "proof" && Number(entry.total_events ?? 0) > 0);
  const proofOnlyPartitions = hasProofRows && invalidPartitions.length === 0;

  const requiredRouteCoverage = expectCmdFrontdoor
    ? [...DIRECT_BASH_ROUTE_COVERAGE, ...CMD_FRONTDOOR_ROUTE_COVERAGE]
    : [...DIRECT_BASH_ROUTE_COVERAGE];
  const requiredRepairCoverage = expectCmdFrontdoor
    ? [...DIRECT_BASH_REPAIR_COVERAGE, ...CMD_FRONTDOOR_REPAIR_COVERAGE]
    : [...DIRECT_BASH_REPAIR_COVERAGE];

  const missingRequiredRouteCoverage = requiredRouteCoverage
    .filter((spec) => !rows.some((row) => rowMatchesSpec(row, spec)))
    .map(describeCoverageSpec);

  const missingRequiredRepairCoverage = requiredRepairCoverage
    .filter((spec) => !rows.some((row) => rowMatchesSpec(row, spec)))
    .map(describeCoverageSpec);

  const hasFailedRows = rows.some((row) => row.success === false);

  return {
    expect_cmd_frontdoor: expectCmdFrontdoor,
    has_proof_rows: hasProofRows,
    proof_only_partitions: proofOnlyPartitions,
    invalid_partitions: invalidPartitions,
    missing_required_operations: missingRequiredOperations,
    missing_required_route_coverage: missingRequiredRouteCoverage,
    missing_required_repair_coverage: missingRequiredRepairCoverage,
    has_failed_rows: hasFailedRows,
    valid: hasProofRows
      && proofOnlyPartitions
      && !hasFailedRows
      && missingRequiredOperations.length === 0
      && missingRequiredRouteCoverage.length === 0
      && missingRequiredRepairCoverage.length === 0,
  };
}

function routeSpec(name, operation, routeName, routeStage, stepName, entrySurface, controlPlaneKind, entrypoint) {
  return {
    name,
    kind: "route",
    operation,
    route_name: routeName,
    route_stage: routeStage,
    step_name: stepName,
    runtime_entry_surface: entrySurface,
    control_plane_kind: controlPlaneKind,
    entrypoint,
  };
}

function repairSpec(name, routeName, stepName, entrySurface, controlPlaneKind, entrypoint) {
  return {
    name,
    kind: "repair",
    operation: "launcher_repair_step",
    route_name: routeName,
    route_stage: "repair",
    step_name: stepName,
    runtime_entry_surface: entrySurface,
    control_plane_kind: controlPlaneKind,
    entrypoint,
  };
}

function rowMatchesSpec(row, spec) {
  return row.operation === spec.operation
    && row.route_name === spec.route_name
    && row.route_stage === spec.route_stage
    && row.step_name === spec.step_name
    && row.runtime_entry_surface === spec.runtime_entry_surface
    && row.control_plane_kind === spec.control_plane_kind
    && row.entrypoint === spec.entrypoint;
}

function describeCoverageSpec(spec) {
  return {
    name: spec.name,
    kind: spec.kind,
    operation: spec.operation,
    route_name: spec.route_name,
    route_stage: spec.route_stage,
    step_name: spec.step_name,
    runtime_entry_surface: spec.runtime_entry_surface,
    control_plane_kind: spec.control_plane_kind,
    entrypoint: spec.entrypoint,
  };
}
