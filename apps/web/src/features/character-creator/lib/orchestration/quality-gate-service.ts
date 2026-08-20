import type { CharacterTextFieldKey } from '../cards/card-schema';
import { evaluateDeterministicQuality, QUALITY_SEVERITIES } from '../evaluation/deterministic-quality-metrics';
import type { iDeterministicQualityFinding } from '../evaluation/deterministic-quality-metrics';
import {
  PROSE_JOB_RESULT_SCHEMA,
  QUALITY_FINDING_EVIDENCE,
  QUALITY_FINDING_SCHEMA,
  QUALITY_FINDING_SEVERITIES,
} from './agent-orchestration-contracts';
import type {
  iCharacterBrief,
  iCharacterContentPlan,
  iProseJob,
  iQualityFinding,
} from './agent-orchestration-contracts';
import type { iAgentCallUsage } from './agent-run-budget';
import { createAgentRunBudget } from './agent-run-budget';

export const MAX_QUALITY_REPAIR_PASSES = 2;

export interface iQualityGateInput {
  brief: iCharacterBrief;
  plan: iCharacterContentPlan;
  jobs: readonly iProseJob[];
  drafts: Partial<Record<CharacterTextFieldKey, string>>;
  currentFields: Partial<Record<CharacterTextFieldKey, string>>;
}

export interface iQualityRoleResult<T> {
  output: T;
  usage: iAgentCallUsage;
}

export interface iQualityGateDependencies {
  criticize: (
    input: iQualityGateInput,
    deterministicFindings: readonly iQualityFinding[],
    abortSignal?: AbortSignal,
  ) => Promise<iQualityRoleResult<unknown>>;
  repair: (
    job: iProseJob,
    currentDrafts: Partial<Record<CharacterTextFieldKey, string>>,
    findings: readonly iQualityFinding[],
    abortSignal?: AbortSignal,
  ) => Promise<iQualityRoleResult<unknown>>;
}

export interface iQualityGateResult {
  drafts: Partial<Record<CharacterTextFieldKey, string>>;
  findings: iQualityFinding[];
  repairCount: number;
  isCriticAvailable: boolean;
  isRepairAvailable: boolean;
  isBudgetExhausted: boolean;
}

function convertDeterministicFinding(finding: iDeterministicQualityFinding): iQualityFinding {
  return QUALITY_FINDING_SCHEMA.parse({
    ruleId: finding.rule,
    fieldKeys: finding.fieldKeys,
    severity:
      finding.severity === QUALITY_SEVERITIES.error
        ? QUALITY_FINDING_SEVERITIES.error
        : QUALITY_FINDING_SEVERITIES.warning,
    evidence: QUALITY_FINDING_EVIDENCE.deterministic,
    explanation: finding.message,
    repairInstruction: finding.repairInstruction,
    isResolved: false,
  });
}

function runDeterministicChecks(input: iQualityGateInput): iQualityFinding[] {
  const constraints = Object.fromEntries(
    input.plan.entries.map((entry) => [
      entry.fieldKey,
      {
        requiredMacros: entry.requiredMacros,
        ...(entry.strictTemplate ? { strictTemplate: entry.strictTemplate } : {}),
      },
    ]),
  );
  return evaluateDeterministicQuality({ fields: input.drafts, constraints }).findings.map(convertDeterministicFinding);
}

function countUnresolvedFindings(findings: readonly iQualityFinding[]): number {
  return findings.filter((finding) => !finding.isResolved).length;
}

function getJobFindings(job: iProseJob, findings: readonly iQualityFinding[]): iQualityFinding[] {
  return findings.filter((finding) => finding.fieldKeys.some((fieldKey) => job.fieldKeys.includes(fieldKey)));
}

export function createQualityGateService(dependencies: iQualityGateDependencies) {
  return {
    async review(
      input: iQualityGateInput,
      budgetLimits: Parameters<typeof createAgentRunBudget>[0],
      abortSignal?: AbortSignal,
    ): Promise<iQualityGateResult> {
      const budget = createAgentRunBudget(budgetLimits);
      let drafts = { ...input.drafts };
      let deterministicFindings = runDeterministicChecks({ ...input, drafts });
      let criticFindings: iQualityFinding[] = [];

      try {
        if (!budget.canStartCall()) throw new Error('Quality budget exhausted before critic call.');
        const criticResult = await dependencies.criticize({ ...input, drafts }, deterministicFindings, abortSignal);
        budget.recordCall(criticResult.usage);
        criticFindings = QUALITY_FINDING_SCHEMA.array().parse(criticResult.output);
      } catch {
        return {
          drafts,
          findings: deterministicFindings,
          repairCount: 0,
          isCriticAvailable: false,
          isRepairAvailable: true,
          isBudgetExhausted: budget.getSnapshot().isExhausted,
        };
      }

      let findings = [...deterministicFindings, ...criticFindings];
      let repairCount = 0;

      for (const job of input.jobs) {
        for (let pass = 0; pass < MAX_QUALITY_REPAIR_PASSES; pass += 1) {
          const jobFindings = getJobFindings(job, findings);
          if (jobFindings.length === 0) break;
          if (!budget.canStartCall()) {
            return {
              drafts,
              findings,
              repairCount,
              isCriticAvailable: true,
              isRepairAvailable: true,
              isBudgetExhausted: true,
            };
          }

          let repairResult: Awaited<ReturnType<iQualityGateDependencies['repair']>>;
          try {
            repairResult = await dependencies.repair(job, drafts, jobFindings, abortSignal);
          } catch {
            return {
              drafts,
              findings,
              repairCount,
              isCriticAvailable: true,
              isRepairAvailable: false,
              isBudgetExhausted: budget.getSnapshot().isExhausted,
            };
          }
          repairCount += 1;
          if (!budget.recordCall(repairResult.usage)) {
            return {
              drafts,
              findings,
              repairCount,
              isCriticAvailable: true,
              isRepairAvailable: true,
              isBudgetExhausted: true,
            };
          }
          const repaired = PROSE_JOB_RESULT_SCHEMA.parse(repairResult.output);
          if (repaired.jobId !== job.id) throw new Error(`Repair result does not match job ${job.id}.`);
          const candidateDrafts = { ...drafts };
          const repairFieldKeys = new Set(jobFindings.flatMap((finding) => finding.fieldKeys));
          for (const fieldKey of job.fieldKeys.filter((jobFieldKey) => repairFieldKeys.has(jobFieldKey))) {
            const repairedValue = repaired.fields[fieldKey];
            if (repairedValue !== undefined) candidateDrafts[fieldKey] = repairedValue;
          }

          const candidateInput = { ...input, drafts: candidateDrafts };
          const candidateDeterministicFindings = runDeterministicChecks(candidateInput);
          if (!budget.canStartCall()) {
            return {
              drafts,
              findings,
              repairCount,
              isCriticAvailable: true,
              isRepairAvailable: true,
              isBudgetExhausted: true,
            };
          }
          let criticResult: Awaited<ReturnType<iQualityGateDependencies['criticize']>>;
          try {
            criticResult = await dependencies.criticize(candidateInput, candidateDeterministicFindings, abortSignal);
          } catch {
            return {
              drafts,
              findings,
              repairCount,
              isCriticAvailable: false,
              isRepairAvailable: true,
              isBudgetExhausted: budget.getSnapshot().isExhausted,
            };
          }
          if (!budget.recordCall(criticResult.usage)) {
            return {
              drafts,
              findings,
              repairCount,
              isCriticAvailable: true,
              isRepairAvailable: true,
              isBudgetExhausted: true,
            };
          }
          const candidateCriticFindings = QUALITY_FINDING_SCHEMA.array().parse(criticResult.output);
          const candidateFindings = [...candidateDeterministicFindings, ...candidateCriticFindings];
          if (countUnresolvedFindings(candidateFindings) >= countUnresolvedFindings(findings)) break;

          drafts = candidateDrafts;
          deterministicFindings = candidateDeterministicFindings;
          findings = candidateFindings;
        }
      }

      return {
        drafts,
        findings,
        repairCount,
        isCriticAvailable: true,
        isRepairAvailable: true,
        isBudgetExhausted: budget.getSnapshot().isExhausted,
      };
    },
  };
}
