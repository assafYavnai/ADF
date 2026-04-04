/**
 * COO -> CTO Admission Packet Builder — Public API
 */

export { buildAdmissionPacket } from "./build-packet.js";
export { validateRequirementArtifact, computeMetadataCompleteness } from "./validate.js";
export { AdmissionKpiTracker } from "./kpi.js";
export { renderAdmissionSummary } from "./render-summary.js";
export {
  handoffFinalizedRequirementToCtoAdmission,
  resetCtoAdmissionThreadState,
  updateCtoAdmissionDecision,
} from "./live-handoff.js";

export type {
  FinalizedRequirementArtifact,
  CtoAdmissionRequest,
  CtoAdmissionDecisionTemplate,
  AdmissionDecision,
  PacketBuildResult,
  PacketBuildOptions,
  SourceMetadataCompleteness,
  KpiSnapshot,
  LatencyBuckets,
  BuildOutcome,
} from "./types.js";
export type {
  AdmissionPersistenceReceipt,
  CtoAdmissionDecisionUpdateInput,
  CtoAdmissionDecisionUpdateResult,
  CtoAdmissionHandoffInput,
  CtoAdmissionHandoffResult,
} from "./live-handoff.js";
export type {
  AdmissionBuildOutcome,
  AdmissionDecisionValue,
  AdmissionKpiState,
  AdmissionLatencySummary,
  AdmissionStatus,
  CtoAdmissionThreadState,
  PacketKpiSnapshot,
} from "./live-state.js";
