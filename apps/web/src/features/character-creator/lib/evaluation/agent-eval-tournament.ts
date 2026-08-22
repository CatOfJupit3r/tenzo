import { z } from 'zod';

import {
  AGENT_EVAL_CORPUS_VERSION,
  AGENT_EVAL_ROUTE_BUDGET_SCHEMA,
  AGENT_EVAL_RUN_ARTIFACT_SCHEMA,
  SINGLE_AGENT_BASELINE_REVISION,
} from './agent-eval-contracts';
import type { iAgentEvalCase, iAgentEvalRunArtifact } from './agent-eval-contracts';
import { runAgentEvalCases } from './agent-eval-runner';
import {
  AGENT_EVAL_EXECUTION_PROFILE_SCHEMA,
  AGENT_EVAL_PIPELINES,
  createAgentEvalRuntime,
} from './agent-eval-runtime.server';
import type { iAgentEvalExecutionProfile, iAgentEvalRuntimeOptions } from './agent-eval-runtime.server';
import { deriveProvisionalRouteBudgets } from './agent-eval-scorecard';

export const ORCHESTRATED_AGENT_PIPELINE_REVISION = 'agent-quality-orchestration-v1';

export const AGENT_EVAL_TOURNAMENT_ARTIFACT_SCHEMA = z.object({
  artifactVersion: z.literal(AGENT_EVAL_CORPUS_VERSION),
  generatedAt: z.string().datetime(),
  profiles: z.array(AGENT_EVAL_EXECUTION_PROFILE_SCHEMA),
  runs: z.array(AGENT_EVAL_RUN_ARTIFACT_SCHEMA),
  baselineBudgets: z.array(AGENT_EVAL_ROUTE_BUDGET_SCHEMA),
  maximumCostUsd: z.number().positive().nullable(),
  isSpendLimitReached: z.boolean(),
});
export type iAgentEvalTournamentArtifact = z.infer<typeof AGENT_EVAL_TOURNAMENT_ARTIFACT_SCHEMA>;

export interface iAgentEvalTournamentOptions {
  cases: readonly iAgentEvalCase[];
  profiles: readonly iAgentEvalExecutionProfile[];
  apiKey: string;
  abortSignal?: AbortSignal;
  maximumCostUsd?: number;
}

export interface iAgentEvalTournamentDependencies {
  runCase: (options: iAgentEvalRuntimeOptions) => ReturnType<ReturnType<typeof createAgentEvalRuntime>['runCase']>;
  now: () => Date;
}

function getPipelineRevision(profile: iAgentEvalExecutionProfile) {
  return profile.pipeline === AGENT_EVAL_PIPELINES['single-agent']
    ? SINGLE_AGENT_BASELINE_REVISION
    : ORCHESTRATED_AGENT_PIPELINE_REVISION;
}

export async function runAgentEvalTournament(
  options: iAgentEvalTournamentOptions,
  dependencies: iAgentEvalTournamentDependencies = {
    runCase: createAgentEvalRuntime().runCase,
    now: () => new Date(),
  },
): Promise<iAgentEvalTournamentArtifact> {
  const profiles = options.profiles.map((profile) => AGENT_EVAL_EXECUTION_PROFILE_SCHEMA.parse(profile));
  const runs: iAgentEvalRunArtifact[] = [];
  const maximumCostUsd =
    options.maximumCostUsd === undefined ? null : z.number().positive().parse(options.maximumCostUsd);
  let totalCostUsd = 0;
  let isSpendLimitReached = false;

  for (const profile of profiles) {
    if (isSpendLimitReached) break;
    options.abortSignal?.throwIfAborted();
    for (const evalCase of options.cases) {
      if (maximumCostUsd !== null && totalCostUsd >= maximumCostUsd) {
        isSpendLimitReached = true;
        break;
      }
      const [run] = await runAgentEvalCases(
        {
          cases: [evalCase],
          pipelineRevision: getPipelineRevision(profile),
          abortSignal: options.abortSignal,
        },
        {
          now: dependencies.now,
          runCase: async (selectedCase) =>
            dependencies.runCase({
              evalCase: selectedCase,
              profile,
              apiKey: options.apiKey,
              abortSignal: options.abortSignal,
            }),
        },
      );
      if (!run) throw new Error('The eval runner returned no artifact for a selected case.');
      runs.push(run);
      totalCostUsd += run.usage.costUsd;
    }
  }

  const baselineRuns = runs.filter((run) => run.pipelineRevision === SINGLE_AGENT_BASELINE_REVISION);
  return AGENT_EVAL_TOURNAMENT_ARTIFACT_SCHEMA.parse({
    artifactVersion: AGENT_EVAL_CORPUS_VERSION,
    generatedAt: dependencies.now().toISOString(),
    profiles,
    runs,
    baselineBudgets: deriveProvisionalRouteBudgets(baselineRuns),
    maximumCostUsd,
    isSpendLimitReached,
  });
}

export function serializeAgentEvalTournament(artifact: iAgentEvalTournamentArtifact) {
  return JSON.stringify(AGENT_EVAL_TOURNAMENT_ARTIFACT_SCHEMA.parse(artifact), null, 2);
}
