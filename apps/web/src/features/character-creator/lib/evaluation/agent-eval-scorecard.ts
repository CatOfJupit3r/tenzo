import { meanBy } from 'lodash-es';

import {
  AGENT_EVAL_PAIRWISE_REVIEW_SCHEMA,
  AGENT_EVAL_ROUTE_BUDGET_SCHEMA,
  AGENT_EVAL_ROUTES,
  AGENT_EVAL_RUBRIC_DIMENSIONS,
  AGENT_EVAL_RUN_ARTIFACT_SCHEMA,
} from './agent-eval-contracts';
import type {
  iAgentEvalFieldScore,
  iAgentEvalPairwiseReview,
  iAgentEvalRouteBudget,
  iAgentEvalRunArtifact,
} from './agent-eval-contracts';

export const AGENT_EVAL_BLINDED_REVIEW_PROTOCOL = {
  minimumReviewsPerCase: 3,
  isPresentationOrderRandomized: true,
  isModelIdentityHidden: true,
  isJudgeDecisionSufficient: false,
  requiresDisagreementReview: true,
} as const;

export const AGENT_EVAL_MODEL_JUDGE_PROTOCOL = {
  isZeroDataRetentionRequired: true,
  isUnmoderatedEndpointRequired: true,
  isProviderDataCollectionDenied: true,
  isRawPromptLoggingAllowed: false,
  isJudgeDecisionSufficient: false,
  requiresSchemaValidatedOutput: true,
  requiresHumanReviewOnDisagreement: true,
} as const;

export interface iAgentEvalScoreSummary {
  meanRubricScore: number;
  usefulDepthScore: number;
  informationUnitCount: number;
  paddingSentenceCount: number;
}

export function summarizeFieldScores(fieldScores: readonly iAgentEvalFieldScore[]): iAgentEvalScoreSummary {
  if (fieldScores.length === 0) {
    return { meanRubricScore: 0, usefulDepthScore: 0, informationUnitCount: 0, paddingSentenceCount: 0 };
  }

  const informationUnitCount = fieldScores.reduce((total, field) => total + field.informationUnitCount, 0);
  const paddingSentenceCount = fieldScores.reduce((total, field) => total + field.paddingSentenceCount, 0);
  const meanRubricScore = meanBy(fieldScores, (field) =>
    meanBy(Object.values(AGENT_EVAL_RUBRIC_DIMENSIONS), (dimension) => field.scores[dimension]),
  );

  return {
    meanRubricScore: Number(meanRubricScore.toFixed(3)),
    usefulDepthScore: Math.max(0, informationUnitCount - paddingSentenceCount),
    informationUnitCount,
    paddingSentenceCount,
  };
}

function percentile95(values: readonly number[]): number {
  const sortedValues = [...values].sort((left, right) => left - right);
  return sortedValues[Math.max(0, Math.ceil(sortedValues.length * 0.95) - 1)] ?? 0;
}

export function deriveProvisionalRouteBudgets(artifacts: readonly iAgentEvalRunArtifact[]): iAgentEvalRouteBudget[] {
  const parsedArtifacts = artifacts.map((artifact) => AGENT_EVAL_RUN_ARTIFACT_SCHEMA.parse(artifact));

  return Object.values(AGENT_EVAL_ROUTES).flatMap((route) => {
    const routeArtifacts = parsedArtifacts.filter((artifact) => artifact.route === route);
    if (routeArtifacts.length === 0) {
      return [];
    }

    const budget = {
      route,
      p95LatencyMs: Math.max(1, percentile95(routeArtifacts.map((artifact) => artifact.latencyMs))),
      p95CostUsd: Math.max(Number.EPSILON, percentile95(routeArtifacts.map((artifact) => artifact.usage.costUsd))),
      maximumCalls: Math.max(1, ...routeArtifacts.map((artifact) => artifact.toolOutcomes.length || 1)),
      maximumOutputTokens: Math.max(1, percentile95(routeArtifacts.map((artifact) => artifact.usage.outputTokens))),
      sourceArtifactCount: routeArtifacts.length,
    } satisfies iAgentEvalRouteBudget;

    return [AGENT_EVAL_ROUTE_BUDGET_SCHEMA.parse(budget)];
  });
}

export function validatePairwiseReviews(reviews: readonly iAgentEvalPairwiseReview[]): iAgentEvalPairwiseReview[] {
  return reviews.map((review) => AGENT_EVAL_PAIRWISE_REVIEW_SCHEMA.parse(review));
}
