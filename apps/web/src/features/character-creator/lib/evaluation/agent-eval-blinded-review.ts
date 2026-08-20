import { z } from 'zod';

import { SeededRandom } from '../prompt/seeded-random';
import {
  AGENT_EVAL_PAIRWISE_REVIEW_SCHEMA,
  AGENT_EVAL_RUBRIC_DIMENSIONS,
  AGENT_EVAL_RUN_ARTIFACT_SCHEMA,
} from './agent-eval-contracts';
import type {
  AgentEvalRubricDimension,
  iAgentEvalCase,
  iAgentEvalPairwiseReview,
  iAgentEvalRunArtifact,
} from './agent-eval-contracts';

const BLINDED_OUTPUT_SCHEMA = AGENT_EVAL_RUN_ARTIFACT_SCHEMA.pick({
  assistantText: true,
  proposedFields: true,
});

export const AGENT_EVAL_BLINDED_BALLOT_SCHEMA = z.object({
  comparisonId: z.string().regex(/^comparison-\d{4}$/),
  caseId: z.string().regex(/^aqo-v1-\d{3}$/),
  caseTitle: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  requestedFieldKeys: z.array(z.string().trim().min(1)),
  presentationOrder: z.tuple([z.string().regex(/^output-\d{4}-[ab]$/), z.string().regex(/^output-\d{4}-[ab]$/)]),
  outputs: z.record(z.string(), BLINDED_OUTPUT_SCHEMA),
});
export type iAgentEvalBlindedBallot = z.infer<typeof AGENT_EVAL_BLINDED_BALLOT_SCHEMA>;

export const AGENT_EVAL_BLINDED_KEY_ENTRY_SCHEMA = z.object({
  comparisonId: AGENT_EVAL_BLINDED_BALLOT_SCHEMA.shape.comparisonId,
  caseId: AGENT_EVAL_BLINDED_BALLOT_SCHEMA.shape.caseId,
  presentations: z.record(
    z.string(),
    z.object({ profileId: z.string().trim().min(1), modelId: z.string().trim().min(1) }),
  ),
});

export const AGENT_EVAL_BLINDED_REVIEW_BUNDLE_SCHEMA = z.object({
  generatedAt: z.string().datetime(),
  seed: z.number().int(),
  ballots: z.array(AGENT_EVAL_BLINDED_BALLOT_SCHEMA),
  key: z.array(AGENT_EVAL_BLINDED_KEY_ENTRY_SCHEMA),
});
export type iAgentEvalBlindedReviewBundle = z.infer<typeof AGENT_EVAL_BLINDED_REVIEW_BUNDLE_SCHEMA>;

export interface iCreateAgentEvalBlindedReviewOptions {
  cases: readonly iAgentEvalCase[];
  runs: readonly iAgentEvalRunArtifact[];
  baselineProfileId: string;
  candidateProfileIds?: readonly string[];
  seed: number;
  now: Date;
}

export interface iAgentEvalReviewProfileSummary {
  profileId: string;
  winCount: number;
  lossCount: number;
  tieCount: number;
  dimensionWinCounts: Record<AgentEvalRubricDimension, number>;
}

export interface iAgentEvalReviewSummary {
  hasMinimumReviews: boolean;
  missingComparisonIds: string[];
  profiles: iAgentEvalReviewProfileSummary[];
}

const MINIMUM_REVIEWS_PER_COMPARISON = 3;

function createDimensionCounts(): Record<AgentEvalRubricDimension, number> {
  return Object.fromEntries(Object.values(AGENT_EVAL_RUBRIC_DIMENSIONS).map((dimension) => [dimension, 0])) as Record<
    AgentEvalRubricDimension,
    number
  >;
}

function getCase(caseId: string, cases: readonly iAgentEvalCase[]) {
  const evalCase = cases.find((candidate) => candidate.id === caseId);
  if (!evalCase) throw new Error(`Missing eval case ${caseId}.`);
  return evalCase;
}

export function createAgentEvalBlindedReviewBundle(
  options: iCreateAgentEvalBlindedReviewOptions,
): iAgentEvalBlindedReviewBundle {
  const parsedRuns = options.runs.map((run) => AGENT_EVAL_RUN_ARTIFACT_SCHEMA.parse(run));
  const baselineRuns = parsedRuns.filter((run) => run.profileId === options.baselineProfileId);
  if (baselineRuns.length === 0) throw new Error(`Missing baseline profile ${options.baselineProfileId}.`);
  const requestedCandidateIds = options.candidateProfileIds
    ? new Set(options.candidateProfileIds)
    : new Set(parsedRuns.map((run) => run.profileId).filter((profileId) => profileId !== options.baselineProfileId));
  const random = new SeededRandom(options.seed);
  const ballots: iAgentEvalBlindedBallot[] = [];
  const key: z.infer<typeof AGENT_EVAL_BLINDED_KEY_ENTRY_SCHEMA>[] = [];

  for (const baselineRun of baselineRuns) {
    for (const candidateProfileId of requestedCandidateIds) {
      const candidateRun = parsedRuns.find(
        (run) => run.caseId === baselineRun.caseId && run.profileId === candidateProfileId,
      );
      if (!candidateRun) continue;
      const evalCase = getCase(baselineRun.caseId, options.cases);
      const comparisonNumber = ballots.length + 1;
      const comparisonId = `comparison-${String(comparisonNumber).padStart(4, '0')}`;
      const presentationIds = [
        `output-${String(comparisonNumber).padStart(4, '0')}-a`,
        `output-${String(comparisonNumber).padStart(4, '0')}-b`,
      ] as const;
      const orderedRuns = random.next() < 0.5 ? [baselineRun, candidateRun] : [candidateRun, baselineRun];
      const presentations = {
        [presentationIds[0]]: { profileId: orderedRuns[0].profileId, modelId: orderedRuns[0].modelId },
        [presentationIds[1]]: { profileId: orderedRuns[1].profileId, modelId: orderedRuns[1].modelId },
      };

      ballots.push(
        AGENT_EVAL_BLINDED_BALLOT_SCHEMA.parse({
          comparisonId,
          caseId: evalCase.id,
          caseTitle: evalCase.title,
          prompt: evalCase.prompt,
          requestedFieldKeys: evalCase.requestedFieldKeys,
          presentationOrder: presentationIds,
          outputs: {
            [presentationIds[0]]: orderedRuns[0],
            [presentationIds[1]]: orderedRuns[1],
          },
        }),
      );
      key.push(AGENT_EVAL_BLINDED_KEY_ENTRY_SCHEMA.parse({ comparisonId, caseId: evalCase.id, presentations }));
    }
  }

  return AGENT_EVAL_BLINDED_REVIEW_BUNDLE_SCHEMA.parse({
    generatedAt: options.now.toISOString(),
    seed: options.seed,
    ballots,
    key,
  });
}

function getWinningPresentationId(review: iAgentEvalPairwiseReview) {
  if (review.decision === 'tie') return null;
  return review.decision === 'candidate-a' ? review.presentationOrder[0] : review.presentationOrder[1];
}

export function summarizeAgentEvalBlindedReviews(
  bundle: iAgentEvalBlindedReviewBundle,
  reviews: readonly iAgentEvalPairwiseReview[],
): iAgentEvalReviewSummary {
  const parsedBundle = AGENT_EVAL_BLINDED_REVIEW_BUNDLE_SCHEMA.parse(bundle);
  const parsedReviews = reviews.map((review) => AGENT_EVAL_PAIRWISE_REVIEW_SCHEMA.parse(review));
  const summaries = new Map<string, iAgentEvalReviewProfileSummary>();
  const missingComparisonIds: string[] = [];

  const getSummary = (profileId: string) => {
    const current = summaries.get(profileId);
    if (current) return current;
    const created: iAgentEvalReviewProfileSummary = {
      profileId,
      winCount: 0,
      lossCount: 0,
      tieCount: 0,
      dimensionWinCounts: createDimensionCounts(),
    };
    summaries.set(profileId, created);
    return created;
  };

  for (const keyEntry of parsedBundle.key) {
    const ballot = parsedBundle.ballots.find((candidate) => candidate.comparisonId === keyEntry.comparisonId);
    if (!ballot) throw new Error(`Missing ballot ${keyEntry.comparisonId}.`);
    const comparisonReviews = parsedReviews.filter(
      (review) =>
        review.caseId === keyEntry.caseId &&
        review.presentationOrder[0] === ballot.presentationOrder[0] &&
        review.presentationOrder[1] === ballot.presentationOrder[1],
    );
    if (new Set(comparisonReviews.map((review) => review.reviewerId)).size < MINIMUM_REVIEWS_PER_COMPARISON) {
      missingComparisonIds.push(keyEntry.comparisonId);
    }

    for (const review of comparisonReviews) {
      const firstProfileId = keyEntry.presentations[review.presentationOrder[0]]?.profileId;
      const secondProfileId = keyEntry.presentations[review.presentationOrder[1]]?.profileId;
      if (!firstProfileId || !secondProfileId)
        throw new Error(`Review presentation order is invalid for ${keyEntry.comparisonId}.`);
      const firstSummary = getSummary(firstProfileId);
      const secondSummary = getSummary(secondProfileId);
      const winningPresentationId = getWinningPresentationId(review);
      if (winningPresentationId === null) {
        firstSummary.tieCount += 1;
        secondSummary.tieCount += 1;
      } else {
        const winningProfileId = keyEntry.presentations[winningPresentationId]?.profileId;
        if (!winningProfileId) throw new Error(`Review winner is invalid for ${keyEntry.comparisonId}.`);
        const losingProfileId = winningProfileId === firstProfileId ? secondProfileId : firstProfileId;
        getSummary(winningProfileId).winCount += 1;
        getSummary(losingProfileId).lossCount += 1;
      }
      for (const dimension of Object.values(AGENT_EVAL_RUBRIC_DIMENSIONS)) {
        const decision = review.dimensionDecisions[dimension];
        if (decision === 'tie') continue;
        const presentationId = decision === 'candidate-a' ? review.presentationOrder[0] : review.presentationOrder[1];
        const profileId = keyEntry.presentations[presentationId]?.profileId;
        if (profileId) getSummary(profileId).dimensionWinCounts[dimension] += 1;
      }
    }
  }

  return {
    hasMinimumReviews: missingComparisonIds.length === 0,
    missingComparisonIds,
    profiles: [...summaries.values()].sort((left, right) => left.profileId.localeCompare(right.profileId)),
  };
}

export function serializeAgentEvalBlindedBallots(bundle: iAgentEvalBlindedReviewBundle) {
  const parsed = AGENT_EVAL_BLINDED_REVIEW_BUNDLE_SCHEMA.parse(bundle);
  return JSON.stringify({ generatedAt: parsed.generatedAt, seed: parsed.seed, ballots: parsed.ballots }, null, 2);
}

export function serializeAgentEvalBlindedKey(bundle: iAgentEvalBlindedReviewBundle) {
  const parsed = AGENT_EVAL_BLINDED_REVIEW_BUNDLE_SCHEMA.parse(bundle);
  return JSON.stringify({ generatedAt: parsed.generatedAt, seed: parsed.seed, key: parsed.key }, null, 2);
}
