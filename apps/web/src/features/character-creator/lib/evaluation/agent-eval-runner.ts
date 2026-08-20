import {
  AGENT_EVAL_CORPUS_VERSION,
  AGENT_EVAL_RUN_ARTIFACT_SCHEMA,
  SINGLE_AGENT_BASELINE_REVISION,
} from './agent-eval-contracts';
import type { iAgentEvalCase, iAgentEvalRunArtifact } from './agent-eval-contracts';

export type iAgentEvalRunResult = Omit<
  iAgentEvalRunArtifact,
  'artifactVersion' | 'caseId' | 'route' | 'pipelineRevision' | 'startedAt' | 'latencyMs'
>;

export interface iAgentEvalRunnerDependencies {
  runCase: (evalCase: iAgentEvalCase) => Promise<iAgentEvalRunResult>;
  now: () => Date;
}

export interface iRunAgentEvalCasesOptions {
  cases: readonly iAgentEvalCase[];
  pipelineRevision?: string;
  abortSignal?: AbortSignal;
}

export async function runAgentEvalCases(
  options: iRunAgentEvalCasesOptions,
  dependencies: iAgentEvalRunnerDependencies,
): Promise<iAgentEvalRunArtifact[]> {
  const artifacts: iAgentEvalRunArtifact[] = [];

  for (const evalCase of options.cases) {
    options.abortSignal?.throwIfAborted();
    const startedAt = dependencies.now();
    const result = await dependencies.runCase(evalCase);
    const latencyMs = Math.max(0, dependencies.now().getTime() - startedAt.getTime());

    artifacts.push(
      AGENT_EVAL_RUN_ARTIFACT_SCHEMA.parse({
        ...result,
        artifactVersion: AGENT_EVAL_CORPUS_VERSION,
        caseId: evalCase.id,
        route: evalCase.route,
        pipelineRevision: options.pipelineRevision ?? SINGLE_AGENT_BASELINE_REVISION,
        startedAt: startedAt.toISOString(),
        latencyMs,
      }),
    );
  }

  return artifacts;
}

export function serializeAgentEvalArtifacts(artifacts: readonly iAgentEvalRunArtifact[]): string {
  return JSON.stringify(
    artifacts.map((artifact) => AGENT_EVAL_RUN_ARTIFACT_SCHEMA.parse(artifact)),
    null,
    2,
  );
}
