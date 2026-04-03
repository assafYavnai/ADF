/**
 * Company Table & Queue Read Model — Public API
 */

export type {
  TableItemState,
  SourceFamily,
  ThreadOnionSnapshot,
  FinalizedRequirementSnapshot,
  CtoAdmissionSnapshot,
  ImplementPlanSnapshot,
  SourceAvailability,
  TableSourceFacts,
  AmbiguityNote,
  TableEntry,
  TableParityCounts,
  CompanyTable,
  TableBuildMetrics,
  TableKpiReport,
} from "./types.js";

export {
  type RawThreadInput,
  type RawRequirementInput,
  type RawAdmissionInput,
  type RawImplementPlanInput,
  adaptThreads,
  adaptRequirements,
  adaptAdmissions,
  adaptImplementPlans,
  collectSourceFacts,
} from "./source-adapters.js";

export { buildCompanyTable } from "./normalizer.js";

export { renderCompanyTable } from "./renderer.js";

export {
  type InstrumentedTableResult,
  buildAndRenderWithKpi,
  recordTableMetrics,
  resetKpiRecords,
  getKpiReport,
} from "./kpi.js";
