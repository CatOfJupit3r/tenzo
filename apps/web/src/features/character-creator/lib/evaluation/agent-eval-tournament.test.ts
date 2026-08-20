import { describe, expect, it, vi } from 'vitest';

import { SINGLE_AGENT_BASELINE_REVISION } from './agent-eval-contracts';
import { AGENT_EVAL_CORPUS } from './agent-eval-corpus';
import { AGENT_EVAL_PIPELINES } from './agent-eval-runtime.server';
import type { iAgentEvalExecutionProfile, iAgentEvalRuntimeOptions } from './agent-eval-runtime.server';
import {
  ORCHESTRATED_AGENT_PIPELINE_REVISION,
  runAgentEvalTournament,
  serializeAgentEvalTournament,
} from './agent-eval-tournament';

const BASE_PROFILE = {
  id: 'baseline',
  pipeline: AGENT_EVAL_PIPELINES['single-agent'],
  providerKind: 'openrouter',
  endpoint: 'https://openrouter.ai/api/v1',
  modelId: 'baseline/model',
  allowedProviderSlug: 'provider-a',
  localCapabilities: ['structured-output', 'tool-calling'],
  qualityProfile: 'balanced',
  maximumOutputTokens: 1_000,
  temperature: 0.8,
  topP: 1,
  promptPricePerMillionUsd: 1,
  completionPricePerMillionUsd: 2,
  seed: null,
} satisfies iAgentEvalExecutionProfile;

function createRunResult(options: iAgentEvalRuntimeOptions) {
  return {
    profileId: options.profile.id,
    modelId: options.profile.modelId,
    providerId: options.profile.allowedProviderSlug,
    seed: options.profile.seed,
    usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.0002 },
    assistantText: 'answer',
    proposedFields: {},
    toolOutcomes: [],
    fieldScores: [],
    isPolicyEligible: true,
    errorCategory: null,
  };
}

describe('agent eval tournament', () => {
  it('runs every case/profile pair, freezes revisions, and derives baseline budgets', async () => {
    const candidate = {
      ...BASE_PROFILE,
      id: 'candidate',
      pipeline: AGENT_EVAL_PIPELINES.orchestrated,
    } satisfies iAgentEvalExecutionProfile;
    const runCase = vi.fn(async (options: iAgentEvalRuntimeOptions) => createRunResult(options));
    const now = vi.fn(() => new Date('2026-08-21T00:00:00.000Z'));

    const artifact = await runAgentEvalTournament(
      { cases: AGENT_EVAL_CORPUS.slice(0, 2), profiles: [BASE_PROFILE, candidate], apiKey: 'secret-key' },
      { runCase, now },
    );

    expect(runCase).toHaveBeenCalledTimes(4);
    expect(artifact.runs.map((run) => run.pipelineRevision)).toEqual([
      SINGLE_AGENT_BASELINE_REVISION,
      SINGLE_AGENT_BASELINE_REVISION,
      ORCHESTRATED_AGENT_PIPELINE_REVISION,
      ORCHESTRATED_AGENT_PIPELINE_REVISION,
    ]);
    expect(artifact.baselineBudgets).toHaveLength(1);
    expect(artifact.baselineBudgets[0]).toMatchObject({ sourceArtifactCount: 2, maximumOutputTokens: 50 });
    expect(serializeAgentEvalTournament(artifact)).not.toContain('secret-key');
  });
});
