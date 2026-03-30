export interface RepairChecklistItem {
  groupId: string;
  severity: string;
  summary: string;
  redesignGuidance: string;
  findingCount: number;
}

export interface RepairRule {
  id: string;
  rule: string;
  applies_to: string[];
  do: string;
  dont: string;
  source: string;
  version: number;
}

export interface RepairSelfCheckIssue {
  code: string;
  message: string;
}

export interface RepairRequest {
  component: string;
  mode: "initial_rule_sweep" | "revision";
  round: number;
  artifactTag: string;
  artifactPathHint: string;
  artifactText: string;
  requiredArtifactInstructions: string;
  rulebook: RepairRule[];
  newRuleIds?: string[];
  findings: RepairChecklistItem[];
  unresolved: string[];
  leaderRationale: string;
  selfCheckIssues?: RepairSelfCheckIssue[];
  bundleDir: string;
  reviewPromptPath: string;
  reviewContractPath: string;
  sourceAuthorityPaths: string[];
  priorIssueCounts?: number[];
}

export interface RepairInvokeResult {
  response: string;
  provenance?: {
    invocation_id?: string;
    provider?: string;
    model?: string;
    was_fallback?: boolean;
  };
}

export interface RepairResult {
  artifact: string;
  complianceMap: Array<{ rule_id: string; status: string; evidence_location: string; evidence_summary: string }>;
  fixItemsMap: Array<{ finding_id?: string; finding_group_id?: string; severity?: string; action: string; summary: string; evidence_location?: string; rejection_reason?: string }>;
  diffSummary: { changed: boolean; prior_length: number; new_length: number; summary: string };
  audit: {
    bundleDir: string;
    manifestPath: string;
    rawResponsePath: string;
    wasFallback: boolean;
    invocationId?: string;
    provider?: string;
    model?: string;
  };
}
