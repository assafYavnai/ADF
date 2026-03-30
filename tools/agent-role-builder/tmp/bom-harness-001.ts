import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createPilotGovernanceContext } from '../../../shared/governance-runtime/engine.ts';
import { loadReviewRuntimeConfigFromPaths } from '../../../shared/review-engine/config.ts';
import { parseReviewerOutput, parseLeaderOutput } from '../../../shared/review-engine/engine.ts';
import { extractRules } from '../../../shared/learning-engine/engine.ts';
import { runComponentRepair } from '../../../shared/component-repair-engine/engine.ts';

const bom = '\ufeff';
const root = 'C:/ADF/tools/agent-role-builder/tmp/bom-harness-001';
const runDir = join(root, 'run');

async function writeCopy(source, destination, withBom = true) {
  const text = await readFile(source, 'utf-8');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${withBom ? bom : ''}${text}`, 'utf-8');
}

await writeCopy('C:/ADF/shared/learning-engine/review-contract.json', join(root, 'shared/learning-engine/review-contract.json'));
await writeCopy('C:/ADF/tools/agent-role-builder/review-contract.json', join(root, 'tools/agent-role-builder/review-contract.json'));
await writeCopy('C:/ADF/tools/agent-role-builder/rulebook.json', join(root, 'tools/agent-role-builder/rulebook.json'));
await writeCopy('C:/ADF/tools/agent-role-builder/review-prompt.json', join(root, 'tools/agent-role-builder/review-prompt.json'));
await writeCopy('C:/ADF/docs/v0/review-process-architecture.md', join(root, 'docs/v0/review-process-architecture.md'), false);
await writeCopy('C:/ADF/docs/v0/architecture.md', join(root, 'docs/v0/architecture.md'), false);

const authority = {
  shared_contract: join(root, 'shared/learning-engine/review-contract.json'),
  component_contract: join(root, 'tools/agent-role-builder/review-contract.json'),
  component_rulebook: join(root, 'tools/agent-role-builder/rulebook.json'),
  component_review_prompt: join(root, 'tools/agent-role-builder/review-prompt.json'),
  authority_docs: [
    join(root, 'docs/v0/review-process-architecture.md'),
    join(root, 'docs/v0/architecture.md'),
  ],
};

const governance = await createPilotGovernanceContext({
  component: 'agent-role-builder',
  run_dir: runDir,
  authority,
});

const config = await loadReviewRuntimeConfigFromPaths({
  sharedContractPath: authority.shared_contract,
  componentPromptPath: authority.component_review_prompt,
  componentContractPath: authority.component_contract,
});

const reviewerVerdict = parseReviewerOutput(`${bom}{"verdict":"approved","conceptual_groups":[],"fix_decisions":[],"residual_risks":[],"strengths":[]}`, { config });
const leaderVerdict = parseLeaderOutput(`${bom}{"status":"pushback","rationale":"need repair","unresolved":["u1"],"improvements_applied":[],"arbitration_used":false,"arbitration_rationale":null}`, { config });

const learning = await extractRules({
  component: 'agent-role-builder',
  round: 0,
  review_findings: [{ group_id: 'g1', summary: 's', severity: 'major', redesign_guidance: 'r', finding_count: 1 }],
  current_rulebook: [],
  review_prompt_domain: 'design',
  review_prompt_path: authority.component_review_prompt,
  review_contract_path: authority.component_contract,
  unresolved_from_leader: [],
}, async () => `${bom}{"new_rules":[],"existing_rules_covering":[],"no_rule_needed":[{"finding_group_id":"g1","reason":"specific"}]}`);

const repair = await runComponentRepair({
  component: 'agent-role-builder',
  mode: 'revision',
  round: 0,
  artifactTag: 'draft',
  artifactPathHint: 'tools/agent-role-builder/role/test-role.md',
  artifactText: '<role>ok</role>',
  requiredArtifactInstructions: 'Return the full updated artifact.',
  rulebook: [],
  newRuleIds: [],
  findings: [{ groupId: 'g1', severity: 'major', summary: 'issue', redesignGuidance: 'fix it', findingCount: 1 }],
  unresolved: ['g1: issue'],
  leaderRationale: 'need repair',
  selfCheckIssues: [],
  bundleDir: join(root, 'repair-bundle'),
  reviewPromptPath: authority.component_review_prompt,
  reviewContractPath: authority.component_contract,
  sourceAuthorityPaths: authority.authority_docs,
  priorIssueCounts: [1],
}, async () => ({
  response: `<draft>\n<role>fixed</role>\n</draft>\n\n<compliance_map>\n${bom}[{"rule_id":"ARB-001","status":"compliant","evidence_location":"<role>","evidence_summary":"ok"}]\n</compliance_map>\n\n<fix_items_map>\n${bom}[{"finding_group_id":"g1","severity":"major","action":"accepted","summary":"fixed","evidence_location":"<role>"}]\n</fix_items_map>`,
  provenance: { provider: 'codex', model: 'gpt-5.4', was_fallback: false },
}));

console.log(JSON.stringify({
  governance_snapshot: governance.snapshot_manifest_path,
  reviewer_verdict: reviewerVerdict.verdict,
  leader_status: leaderVerdict.status,
  learning_no_rule_needed: learning.no_rule_needed.length,
  repair_artifact_changed: repair.diffSummary.changed,
  repair_manifest_exists: true,
}, null, 2));
