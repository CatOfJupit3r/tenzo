import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { SeededRandom } from '../prompt/seeded-random';
import {
  AGENT_EVAL_BLINDED_REVIEW_BUNDLE_SCHEMA,
  createAgentEvalBlindedReviewBundle,
  serializeAgentEvalBlindedBallots,
  summarizeAgentEvalBlindedReviews,
} from './agent-eval-blinded-review';
import { AGENT_EVAL_PAIRWISE_REVIEW_SCHEMA } from './agent-eval-contracts';
import { AGENT_EVAL_CORPUS } from './agent-eval-corpus';
import { AGENT_EVAL_TOURNAMENT_ARTIFACT_SCHEMA } from './agent-eval-tournament';

const REVIEW_COMMAND_SCHEMA = z.enum(['prepare', 'score']);

function getRequiredArgument(value: string | undefined, label: string) {
  if (!value?.trim()) throw new Error(`Missing ${label}.`);
  return value;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
}

async function writeJson(path: string, value: string) {
  const outputPath = resolve(path);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${value}\n`, 'utf8');
}

async function prepareReview() {
  const tournamentPath = getRequiredArgument(process.argv[3], 'tournament artifact path');
  const ballotPath = getRequiredArgument(process.argv[4], 'public ballot output path');
  const privateBundlePath = getRequiredArgument(process.argv[5], 'private review bundle output path');
  const baselineProfileId = getRequiredArgument(process.argv[6], 'baseline profile ID');
  const candidateProfileIds = process.argv.slice(7);
  const tournament = AGENT_EVAL_TOURNAMENT_ARTIFACT_SCHEMA.parse(await readJson(tournamentPath));
  const configuredSeed = Number(process.env.TENZO_AGENT_EVAL_REVIEW_SEED);
  const seed = Number.isInteger(configuredSeed) ? configuredSeed : SeededRandom.generateSeed();
  const bundle = createAgentEvalBlindedReviewBundle({
    cases: AGENT_EVAL_CORPUS,
    runs: tournament.runs,
    baselineProfileId,
    ...(candidateProfileIds.length > 0 ? { candidateProfileIds } : {}),
    seed,
    now: new Date(),
  });
  await writeJson(ballotPath, serializeAgentEvalBlindedBallots(bundle));
  await writeJson(privateBundlePath, JSON.stringify(bundle, null, 2));
  process.stdout.write(`Wrote ${bundle.ballots.length} blinded comparisons; keep the private bundle hidden.\n`);
}

async function scoreReview() {
  const privateBundlePath = getRequiredArgument(process.argv[3], 'private review bundle path');
  const reviewsPath = getRequiredArgument(process.argv[4], 'review responses path');
  const summaryPath = getRequiredArgument(process.argv[5], 'review summary output path');
  const bundle = AGENT_EVAL_BLINDED_REVIEW_BUNDLE_SCHEMA.parse(await readJson(privateBundlePath));
  const reviews = AGENT_EVAL_PAIRWISE_REVIEW_SCHEMA.array().parse(await readJson(reviewsPath));
  const summary = summarizeAgentEvalBlindedReviews(bundle, reviews);
  await writeJson(summaryPath, JSON.stringify(summary, null, 2));
  process.stdout.write(
    `Wrote review summary for ${summary.profiles.length} profiles; minimum review coverage ${summary.hasMinimumReviews ? 'passed' : 'incomplete'}.\n`,
  );
}

const command = REVIEW_COMMAND_SCHEMA.parse(process.argv[2]);
if (command === 'prepare') await prepareReview();
else await scoreReview();
