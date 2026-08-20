import { describe, expect, it, vi } from 'vitest';

import baselineProfileFile from './agent-eval-baseline.2026-08-21.json';
import { SINGLE_AGENT_BASELINE_REVISION } from './agent-eval-contracts';
import { AGENT_EVAL_CORPUS } from './agent-eval-corpus';
import { AGENT_EVAL_EXECUTION_PROFILE_SCHEMA, AGENT_EVAL_PIPELINES } from './agent-eval-runtime.server';
import type { iAgentEvalExecutionProfile, iAgentEvalRuntimeOptions } from './agent-eval-runtime.server';
import screeningProfileFile from './agent-eval-screening.2026-08-21.json';
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
  it('pins a schema-valid screening matrix across baseline, single-model, two-model, and specialized profiles', () => {
    const baselineProfiles = AGENT_EVAL_EXECUTION_PROFILE_SCHEMA.array().parse(baselineProfileFile.profiles);
    const screeningProfiles = AGENT_EVAL_EXECUTION_PROFILE_SCHEMA.array().parse(screeningProfileFile.profiles);
    const structuredModelIds = new Set(
      screeningProfiles.flatMap((profile) => [
        profile.modelId,
        ...Object.entries(profile.roleAssignments ?? {}).flatMap(([role, assignment]) =>
          role === 'prose-worker' || !assignment ? [] : [assignment.modelId],
        ),
      ]),
    );
    const proseModelIds = new Set(
      screeningProfiles.flatMap((profile) => {
        const assignment = profile.roleAssignments?.['prose-worker'];
        return assignment ? [assignment.modelId] : [];
      }),
    );

    expect(baselineProfiles).toHaveLength(1);
    expect(screeningProfiles.some((profile) => profile.pipeline === AGENT_EVAL_PIPELINES['single-agent'])).toBe(true);
    expect(screeningProfiles.some((profile) => profile.roleAssignments?.['prose-worker'])).toBe(true);
    expect(screeningProfiles.some((profile) => Object.keys(profile.roleAssignments ?? {}).length > 1)).toBe(true);
    expect(structuredModelIds.size).toBeGreaterThanOrEqual(3);
    expect(proseModelIds.size).toBeGreaterThanOrEqual(3);
    expect(screeningProfileFile.caseIds).toHaveLength(12);
    expect(screeningProfileFile.caseIds.every((caseId) => AGENT_EVAL_CORPUS.some((item) => item.id === caseId))).toBe(
      true,
    );
  });

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
