import { describe, expect, it, vi } from 'vitest';

import {
  AGENT_EVAL_CORPUS_VERSION,
  AGENT_EVAL_FAILURE_CLASSES,
  AGENT_EVAL_ROUTES,
  AGENT_EVAL_RUBRIC_DIMENSIONS,
  SINGLE_AGENT_BASELINE_REVISION,
} from './agent-eval-contracts';
import type { iAgentEvalFieldScore, iAgentEvalRunArtifact } from './agent-eval-contracts';
import { AGENT_EVAL_CORPUS } from './agent-eval-corpus';
import { AGENT_EVAL_FIELD_RUBRICS, AGENT_EVAL_SCORE_ANCHORS } from './agent-eval-rubric';
import { runAgentEvalCases, serializeAgentEvalArtifacts } from './agent-eval-runner';
import {
  AGENT_EVAL_BLINDED_REVIEW_PROTOCOL,
  AGENT_EVAL_MODEL_JUDGE_PROTOCOL,
  deriveProvisionalRouteBudgets,
  summarizeFieldScores,
} from './agent-eval-scorecard';

function createScores(score: 1 | 2 | 3 | 4 | 5) {
  return {
    [AGENT_EVAL_RUBRIC_DIMENSIONS.fidelity]: score,
    [AGENT_EVAL_RUBRIC_DIMENSIONS.completeness]: score,
    [AGENT_EVAL_RUBRIC_DIMENSIONS.specificity]: score,
    [AGENT_EVAL_RUBRIC_DIMENSIONS['roleplay-usability']]: score,
    [AGENT_EVAL_RUBRIC_DIMENSIONS.voice]: score,
    [AGENT_EVAL_RUBRIC_DIMENSIONS.format]: score,
    [AGENT_EVAL_RUBRIC_DIMENSIONS.coherence]: score,
    [AGENT_EVAL_RUBRIC_DIMENSIONS['non-repetition']]: score,
  };
}

function createArtifact(overrides: Partial<iAgentEvalRunArtifact> = {}): iAgentEvalRunArtifact {
  return {
    artifactVersion: AGENT_EVAL_CORPUS_VERSION,
    caseId: 'aqo-v1-001',
    route: AGENT_EVAL_ROUTES.advice,
    pipelineRevision: SINGLE_AGENT_BASELINE_REVISION,
    profileId: 'baseline',
    modelId: 'test-model',
    providerId: 'local-test',
    seed: null,
    startedAt: '2026-08-21T00:00:00.000Z',
    latencyMs: 120,
    usage: { inputTokens: 10, outputTokens: 20, costUsd: 0.01 },
    assistantText: 'Content remains in the local artifact.',
    proposedFields: {},
    toolOutcomes: [],
    fieldScores: [],
    isPolicyEligible: true,
    errorCategory: null,
    ...overrides,
  };
}

describe('agent eval foundation', () => {
  it('provides 30 unique versioned cases across every route and failure class', () => {
    expect(AGENT_EVAL_CORPUS).toHaveLength(30);
    expect(new Set(AGENT_EVAL_CORPUS.map((evalCase) => evalCase.id))).toHaveLength(30);

    const routes = new Set(AGENT_EVAL_CORPUS.map((evalCase) => evalCase.route));
    expect(routes).toEqual(new Set(Object.values(AGENT_EVAL_ROUTES)));

    const failureClasses = new Set(AGENT_EVAL_CORPUS.flatMap((evalCase) => evalCase.failureClasses));
    expect(failureClasses).toEqual(new Set(Object.values(AGENT_EVAL_FAILURE_CLASSES)));
    expect(AGENT_EVAL_CORPUS.some((evalCase) => evalCase.isMatureTheme)).toBe(true);
  });

  it('defines field-specific purposes and complete score anchors', () => {
    expect(AGENT_EVAL_FIELD_RUBRICS.description.purpose).not.toBe(AGENT_EVAL_FIELD_RUBRICS.personality.purpose);
    expect(AGENT_EVAL_FIELD_RUBRICS.scenario.emphasizedDimensions).toContain(
      AGENT_EVAL_RUBRIC_DIMENSIONS['roleplay-usability'],
    );
    expect(Object.keys(AGENT_EVAL_SCORE_ANCHORS)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('scores useful information separately from padded length', () => {
    const conciseComplete = {
      fieldKey: 'description',
      scores: createScores(4),
      informationUnitCount: 6,
      paddingSentenceCount: 0,
    } satisfies iAgentEvalFieldScore;
    const longPadded = {
      fieldKey: 'personality',
      scores: createScores(2),
      informationUnitCount: 7,
      paddingSentenceCount: 5,
    } satisfies iAgentEvalFieldScore;

    expect(summarizeFieldScores([conciseComplete]).usefulDepthScore).toBe(6);
    expect(summarizeFieldScores([longPadded]).usefulDepthScore).toBe(2);
  });

  it('derives provisional route budgets from measured artifacts', () => {
    const budgets = deriveProvisionalRouteBudgets([
      createArtifact(),
      createArtifact({ latencyMs: 250, usage: { inputTokens: 20, outputTokens: 80, costUsd: 0.03 } }),
      createArtifact({ route: AGENT_EVAL_ROUTES['focused-edit'], latencyMs: 400 }),
    ]);

    expect(budgets).toEqual([
      expect.objectContaining({ route: AGENT_EVAL_ROUTES.advice, p95LatencyMs: 250, sourceArtifactCount: 2 }),
      expect.objectContaining({ route: AGENT_EVAL_ROUTES['focused-edit'], p95LatencyMs: 400, sourceArtifactCount: 1 }),
    ]);
  });

  it('captures reproducible local artifacts without accepting credentials', async () => {
    const runCase = vi.fn().mockResolvedValue({
      profileId: 'baseline',
      modelId: 'test-model',
      providerId: 'local-test',
      seed: null,
      usage: { inputTokens: 10, outputTokens: 20, costUsd: 0 },
      assistantText: 'Advice only.',
      proposedFields: {},
      toolOutcomes: [],
      fieldScores: [],
      isPolicyEligible: true,
      errorCategory: null,
    });
    const now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(new Date('2026-08-21T00:00:00.000Z'))
      .mockReturnValueOnce(new Date('2026-08-21T00:00:00.125Z'));

    const artifacts = await runAgentEvalCases({ cases: [AGENT_EVAL_CORPUS[0]] }, { runCase, now });

    expect(artifacts[0]).toEqual(
      expect.objectContaining({
        artifactVersion: AGENT_EVAL_CORPUS_VERSION,
        pipelineRevision: SINGLE_AGENT_BASELINE_REVISION,
        latencyMs: 125,
      }),
    );
    expect(serializeAgentEvalArtifacts(artifacts)).not.toContain('apiKey');
  });

  it('requires blinded human review and policy-eligible model judging', () => {
    expect(AGENT_EVAL_BLINDED_REVIEW_PROTOCOL).toEqual(
      expect.objectContaining({
        minimumReviewsPerCase: 3,
        isPresentationOrderRandomized: true,
        isModelIdentityHidden: true,
        isJudgeDecisionSufficient: false,
      }),
    );
    expect(AGENT_EVAL_MODEL_JUDGE_PROTOCOL).toEqual(
      expect.objectContaining({
        isZeroDataRetentionRequired: true,
        isUnmoderatedEndpointRequired: true,
        isProviderDataCollectionDenied: true,
        isJudgeDecisionSufficient: false,
      }),
    );
  });
});
