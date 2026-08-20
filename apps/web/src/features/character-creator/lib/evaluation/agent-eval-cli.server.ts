import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { AGENT_EVAL_CORPUS } from './agent-eval-corpus';
import { AGENT_EVAL_EXECUTION_PROFILE_SCHEMA } from './agent-eval-runtime.server';
import { runAgentEvalTournament, serializeAgentEvalTournament } from './agent-eval-tournament';

const PROFILE_FILE_SCHEMA = z.object({
  profiles: z.array(AGENT_EVAL_EXECUTION_PROFILE_SCHEMA).min(1),
  caseIds: z.array(z.string()).optional(),
});

function getRequiredArgument(value: string | undefined, label: string) {
  if (!value?.trim()) throw new Error(`Missing ${label}.`);
  return value;
}

async function main() {
  const profilePath = resolve(getRequiredArgument(process.argv[2], 'profile JSON path'));
  const outputPath = resolve(getRequiredArgument(process.argv[3], 'output JSON path'));
  const profileFile = PROFILE_FILE_SCHEMA.parse(JSON.parse(await readFile(profilePath, 'utf8')));
  const selectedCaseIds = profileFile.caseIds ? new Set(profileFile.caseIds) : null;
  const cases = selectedCaseIds
    ? AGENT_EVAL_CORPUS.filter((evalCase) => selectedCaseIds.has(evalCase.id))
    : AGENT_EVAL_CORPUS;
  if (cases.length === 0) throw new Error('The profile file selected no eval cases.');
  if (selectedCaseIds && cases.length !== selectedCaseIds.size) {
    throw new Error('The profile file contains an unknown eval case ID.');
  }

  const hasRemoteProfile = profileFile.profiles.some((profile) => profile.providerKind === 'openrouter');
  const configuredApiKey = process.env.TENZO_AGENT_EVAL_API_KEY?.trim();
  let apiKey = configuredApiKey ?? '';
  if (!apiKey && !hasRemoteProfile) apiKey = 'local-eval';
  if (!apiKey) {
    throw new Error('Set TENZO_AGENT_EVAL_API_KEY in the process environment for remote evaluation.');
  }

  const artifact = await runAgentEvalTournament({ cases, profiles: profileFile.profiles, apiKey });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${serializeAgentEvalTournament(artifact)}\n`, 'utf8');

  const totalCostUsd = artifact.runs.reduce((total, run) => total + run.usage.costUsd, 0);
  process.stdout.write(
    `Wrote ${artifact.runs.length} content-safe eval artifacts to ${outputPath}; total recorded cost $${totalCostUsd.toFixed(4)}.\n`,
  );
}

await main();
