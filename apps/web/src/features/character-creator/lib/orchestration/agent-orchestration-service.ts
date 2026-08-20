import type { CharacterTextFieldKey } from '../cards/card-schema';
import {
  AGENT_ORCHESTRATION_RECOVERIES,
  AGENT_ORCHESTRATION_RESULT_SCHEMA,
  AGENT_PROGRESS_PHASES,
  AGENT_ROUTES,
  AGENT_ROUTE_DECISION_SCHEMA,
  PROSE_JOB_RESULT_SCHEMA,
  QUALITY_FINDING_SEVERITIES,
} from './agent-orchestration-contracts';
import type {
  AgentProgressPhase,
  iAgentOrchestrationResult,
  iProseJob,
  iProseJobResult,
} from './agent-orchestration-contracts';
import type { iAgentCallUsage, iAgentRunBudgetLimits } from './agent-run-budget';
import { createAgentRunBudget } from './agent-run-budget';
import type { iCharacterBriefInput, iCharacterBriefResult } from './character-brief-service';
import type { iContentPlanInput } from './content-plan-service';
import type { iQualityGateInput, iQualityGateResult } from './quality-gate-service';

export interface iAgentOrchestrationInput extends iCharacterBriefInput {
  runId: string;
  currentFields: Partial<Record<CharacterTextFieldKey, string>>;
  strictTemplates: Partial<Record<CharacterTextFieldKey, string>>;
  requiredMacros: Partial<Record<CharacterTextFieldKey, readonly string[]>>;
  writerBudget: iAgentRunBudgetLimits;
  qualityBudget: iAgentRunBudgetLimits;
  abortSignal?: AbortSignal;
  onPhaseChange?: (phase: AgentProgressPhase) => void;
}

export interface iAgentOrchestrationCallResult<T> {
  output: T;
  usage: iAgentCallUsage;
}

export interface iAgentOrchestrationDependencies {
  routeIntent: (input: iAgentOrchestrationInput) => Promise<iAgentOrchestrationCallResult<unknown>>;
  createBrief: (input: iCharacterBriefInput, abortSignal?: AbortSignal) => Promise<iCharacterBriefResult>;
  createPlan: (
    input: iContentPlanInput,
    abortSignal?: AbortSignal,
  ) => Promise<{ plan: iQualityGateInput['plan']; jobs: iProseJob[] }>;
  writeProse: (job: iProseJob, abortSignal?: AbortSignal) => Promise<iAgentOrchestrationCallResult<unknown>>;
  reviewQuality: (
    input: iQualityGateInput,
    budget: iAgentRunBudgetLimits,
    abortSignal?: AbortSignal,
  ) => Promise<iQualityGateResult>;
  submitProposal: (
    drafts: Partial<Record<CharacterTextFieldKey, string>>,
    findings: iQualityGateResult['findings'],
  ) => Promise<{ proposalId: string }>;
}

interface iProseJobResultCandidate {
  job: iProseJob;
  output: unknown;
}

function emitPhase(input: iAgentOrchestrationInput, phase: AgentProgressPhase) {
  input.onPhaseChange?.(phase);
}

function createBaseResult(input: iAgentOrchestrationInput): iAgentOrchestrationResult {
  return {
    runId: input.runId,
    route: AGENT_ROUTES['full-card'],
    phase: AGENT_PROGRESS_PHASES.failed,
    brief: null,
    plan: null,
    drafts: {},
    findings: [],
    answer: '',
    recovery: null,
    proposalId: null,
  };
}

function assertJobResult(candidate: iProseJobResultCandidate): iProseJobResult {
  const result = PROSE_JOB_RESULT_SCHEMA.parse(candidate.output);
  if (result.jobId !== candidate.job.id) throw new Error(`Prose result does not match job ${candidate.job.id}.`);
  const resultFieldKeys = Object.keys(result.fields);
  if (
    resultFieldKeys.length !== candidate.job.fieldKeys.length ||
    resultFieldKeys.some((fieldKey) => !candidate.job.fieldKeys.includes(fieldKey as CharacterTextFieldKey))
  ) {
    throw new Error(`Prose result for ${candidate.job.id} must contain only its assigned fields.`);
  }
  return result;
}

async function runProseJobs(
  jobs: readonly iProseJob[],
  input: iAgentOrchestrationInput,
  dependencies: iAgentOrchestrationDependencies,
) {
  const budget = createAgentRunBudget(input.writerBudget);
  const pendingJobs = new Map(jobs.map((job) => [job.id, job]));
  const completedJobIds = new Set<string>();
  const drafts: Partial<Record<CharacterTextFieldKey, string>> = {};

  while (pendingJobs.size > 0) {
    const readyJobs = [...pendingJobs.values()].filter((job) =>
      job.dependsOnJobIds.every((jobId) => completedJobIds.has(jobId)),
    );
    if (readyJobs.length === 0) throw new Error('Prose job dependencies contain a cycle or missing job.');
    if (!budget.canStartCall() || readyJobs.length > input.writerBudget.maximumCalls - budget.getSnapshot().callCount) {
      return { drafts, isComplete: false, isBudgetExhausted: true };
    }

    const results = await Promise.allSettled(
      readyJobs.map(async (job) => ({ job, result: await dependencies.writeProse(job, input.abortSignal) })),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        return { drafts, isComplete: false, isBudgetExhausted: budget.getSnapshot().isExhausted };
      }
      if (!budget.recordCall(result.value.result.usage)) {
        return { drafts, isComplete: false, isBudgetExhausted: true };
      }
      const proseResult = assertJobResult({ job: result.value.job, output: result.value.result.output });
      Object.assign(drafts, proseResult.fields);
      pendingJobs.delete(result.value.job.id);
      completedJobIds.add(result.value.job.id);
    }
  }

  return { drafts, isComplete: true, isBudgetExhausted: budget.getSnapshot().isExhausted };
}

function isCancellation(error: unknown, abortSignal?: AbortSignal): boolean {
  return abortSignal?.aborted === true || (error instanceof Error && error.name === 'AbortError');
}

export function createAgentOrchestrationService(dependencies: iAgentOrchestrationDependencies) {
  return {
    async run(input: iAgentOrchestrationInput): Promise<iAgentOrchestrationResult> {
      const result = createBaseResult(input);
      try {
        emitPhase(input, AGENT_PROGRESS_PHASES.understanding);
        input.abortSignal?.throwIfAborted();
        const routeCall = await dependencies.routeIntent(input);
        const routeDecision = AGENT_ROUTE_DECISION_SCHEMA.parse(routeCall.output);
        result.route = routeDecision.route;

        if (routeDecision.route === AGENT_ROUTES.advice) {
          result.phase = AGENT_PROGRESS_PHASES.completed;
          result.answer = routeDecision.answer ?? '';
          emitPhase(input, result.phase);
          return AGENT_ORCHESTRATION_RESULT_SCHEMA.parse(result);
        }

        const briefResult = await dependencies.createBrief(input, input.abortSignal);
        result.brief = briefResult.brief;
        if (briefResult.brief.unresolvedQuestions.length > 0) {
          result.phase = AGENT_PROGRESS_PHASES.failed;
          result.recovery = AGENT_ORCHESTRATION_RECOVERIES['clarification-required'];
          result.answer = briefResult.brief.unresolvedQuestions.map((question) => question.question).join('\n');
          emitPhase(input, result.phase);
          return AGENT_ORCHESTRATION_RESULT_SCHEMA.parse(result);
        }

        emitPhase(input, AGENT_PROGRESS_PHASES.planning);
        const planInput = {
          brief: briefResult.brief,
          requestedFieldKeys: input.requestedFieldKeys,
          currentFields: input.currentFields,
          strictTemplates: input.strictTemplates,
          requiredMacros: input.requiredMacros,
        } satisfies iContentPlanInput;
        const { plan, jobs } = await dependencies.createPlan(planInput, input.abortSignal);
        result.plan = plan;

        emitPhase(input, AGENT_PROGRESS_PHASES.drafting);
        const prose = await runProseJobs(jobs, input, dependencies);
        result.drafts = prose.drafts;
        if (!prose.isComplete) {
          result.phase = AGENT_PROGRESS_PHASES.failed;
          result.recovery = prose.isBudgetExhausted
            ? AGENT_ORCHESTRATION_RECOVERIES['repair-budget-exhausted']
            : AGENT_ORCHESTRATION_RECOVERIES['partial-draft'];
          result.answer = 'Some drafts could not be completed. No proposal was created.';
          emitPhase(input, result.phase);
          return AGENT_ORCHESTRATION_RESULT_SCHEMA.parse(result);
        }

        emitPhase(input, AGENT_PROGRESS_PHASES.reviewing);
        const quality = await dependencies.reviewQuality(
          {
            brief: briefResult.brief,
            plan,
            jobs,
            drafts: prose.drafts,
            currentFields: input.currentFields,
          },
          input.qualityBudget,
          input.abortSignal,
        );
        result.drafts = quality.drafts;
        result.findings = quality.findings;
        if (!quality.isCriticAvailable) {
          result.recovery = AGENT_ORCHESTRATION_RECOVERIES['critic-unavailable'];
        } else if (!quality.isRepairAvailable) {
          result.recovery = AGENT_ORCHESTRATION_RECOVERIES['repair-unavailable'];
        } else if (quality.isBudgetExhausted) {
          result.recovery = AGENT_ORCHESTRATION_RECOVERIES['repair-budget-exhausted'];
        }
        if (quality.repairCount > 0) emitPhase(input, AGENT_PROGRESS_PHASES.repairing);

        const hasBlockingFinding = quality.findings.some(
          (finding) => !finding.isResolved && finding.severity === QUALITY_FINDING_SEVERITIES.error,
        );
        if (hasBlockingFinding) {
          result.phase = AGENT_PROGRESS_PHASES.failed;
          result.answer = 'Draft review found unresolved blocking issues. No proposal was created.';
          emitPhase(input, result.phase);
          return AGENT_ORCHESTRATION_RESULT_SCHEMA.parse(result);
        }

        emitPhase(input, AGENT_PROGRESS_PHASES.proposing);
        const proposal = await dependencies.submitProposal(quality.drafts, quality.findings);
        result.proposalId = proposal.proposalId;
        result.phase = AGENT_PROGRESS_PHASES.completed;
        result.answer =
          quality.findings.length > 0
            ? 'Drafts are ready for review with quality warnings.'
            : 'Drafts are ready for review.';
        emitPhase(input, result.phase);
        return AGENT_ORCHESTRATION_RESULT_SCHEMA.parse(result);
      } catch (error) {
        if (isCancellation(error, input.abortSignal)) {
          result.phase = AGENT_PROGRESS_PHASES.cancelled;
          result.recovery = AGENT_ORCHESTRATION_RECOVERIES.cancelled;
          result.answer = 'Generation was cancelled before any proposal was submitted.';
          emitPhase(input, result.phase);
          return AGENT_ORCHESTRATION_RESULT_SCHEMA.parse(result);
        }
        result.phase = AGENT_PROGRESS_PHASES.failed;
        result.answer = error instanceof Error ? error.message : 'Agent orchestration failed.';
        emitPhase(input, result.phase);
        return AGENT_ORCHESTRATION_RESULT_SCHEMA.parse(result);
      }
    },
  };
}
