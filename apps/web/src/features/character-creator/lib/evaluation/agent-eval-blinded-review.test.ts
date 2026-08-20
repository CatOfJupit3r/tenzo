import { describe, expect, it } from 'vitest';

import {
  createAgentEvalBlindedReviewBundle,
  serializeAgentEvalBlindedBallots,
  serializeAgentEvalBlindedKey,
  summarizeAgentEvalBlindedReviews,
} from './agent-eval-blinded-review';
import { AGENT_EVAL_RUBRIC_DIMENSIONS } from './agent-eval-contracts';
import type { iAgentEvalPairwiseReview, iAgentEvalRunArtifact } from './agent-eval-contracts';
import { AGENT_EVAL_CORPUS } from './agent-eval-corpus';

function createRun(profileId: string, modelId: string): iAgentEvalRunArtifact {
  return {
    artifactVersion: '1.0.0',
    caseId: 'aqo-v1-001',
    route: 'advice',
    pipelineRevision: profileId,
    profileId,
    modelId,
    providerId: 'provider',
    seed: null,
    startedAt: '2026-08-21T00:00:00.000Z',
    latencyMs: 100,
    usage: { inputTokens: 10, outputTokens: 10, costUsd: 0.001 },
    assistantText: `${profileId} answer`,
    proposedFields: {},
    toolOutcomes: [],
    fieldScores: [],
    isPolicyEligible: true,
    errorCategory: null,
  };
}

function createReview(
  presentationOrder: [string, string],
  reviewerId: string,
  decision: iAgentEvalPairwiseReview['decision'],
): iAgentEvalPairwiseReview {
  return {
    caseId: 'aqo-v1-001',
    reviewerId,
    presentationOrder,
    decision,
    dimensionDecisions: Object.fromEntries(
      Object.values(AGENT_EVAL_RUBRIC_DIMENSIONS).map((dimension) => [dimension, decision]),
    ) as iAgentEvalPairwiseReview['dimensionDecisions'],
    notes: '',
  };
}

describe('agent eval blinded review', () => {
  it('separates model identity from randomized reviewer ballots', () => {
    const bundle = createAgentEvalBlindedReviewBundle({
      cases: AGENT_EVAL_CORPUS,
      runs: [createRun('baseline', 'baseline/model'), createRun('candidate', 'candidate/model')],
      baselineProfileId: 'baseline',
      seed: 42,
      now: new Date('2026-08-21T00:00:00.000Z'),
    });

    expect(bundle.ballots).toHaveLength(1);
    expect(bundle.key).toHaveLength(1);
    expect(serializeAgentEvalBlindedBallots(bundle)).not.toContain('candidate/model');
    expect(serializeAgentEvalBlindedBallots(bundle)).not.toContain('baseline/model');
    expect(serializeAgentEvalBlindedKey(bundle)).toContain('candidate/model');
  });

  it('requires three distinct reviewers and resolves blinded decisions through the private key', () => {
    const bundle = createAgentEvalBlindedReviewBundle({
      cases: AGENT_EVAL_CORPUS,
      runs: [createRun('baseline', 'baseline/model'), createRun('candidate', 'candidate/model')],
      baselineProfileId: 'baseline',
      seed: 42,
      now: new Date('2026-08-21T00:00:00.000Z'),
    });
    const order = bundle.ballots[0]?.presentationOrder;
    if (!order) throw new Error('Missing blinded ballot.');
    const reviews = [
      createReview(order, 'reviewer-1', 'candidate-a'),
      createReview(order, 'reviewer-2', 'candidate-a'),
      createReview(order, 'reviewer-3', 'tie'),
    ];

    const summary = summarizeAgentEvalBlindedReviews(bundle, reviews);

    expect(summary.hasMinimumReviews).toBe(true);
    expect(summary.missingComparisonIds).toEqual([]);
    expect(summary.profiles.reduce((total, profile) => total + profile.winCount, 0)).toBe(2);
    expect(summary.profiles.every((profile) => profile.tieCount === 1)).toBe(true);
  });
});
