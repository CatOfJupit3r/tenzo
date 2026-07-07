import { generateText, stepCountIs } from 'ai';
import type { ModelMessage } from 'ai';

import { createCharacterLanguageModel } from './ai-sdk-text-generation';
import type { CharacterCard } from './card-schema';
import { createCharacterAgentTools } from './character-agent-tools';
import type { iCharacterGenerationSettings } from './generation-config';

interface iCreateCharacterAgentOptions {
  card: CharacterCard;
  apiKey: string;
  generationSettings: iCharacterGenerationSettings;
  shouldSendDisabledSamplers?: boolean;
  generalCharacterIdea?: string;
  store: Parameters<typeof createCharacterAgentTools>[0];
}

interface iCharacterAgentModelSettings {
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

function buildCharacterAgentInstructions({
  card,
  generalCharacterIdea,
}: {
  card: CharacterCard;
  generalCharacterIdea?: string;
}) {
  const characterName = card.data.name.trim() ? card.data.name : 'Untitled character';

  return [
    'You are a character editor agent working inside a local-first character creator.',
    'Your job is to help the user revise the character as a whole by using tools to edit a draft card.',
    'Always inspect the current draft with read_character before making substantial changes.',
    'Use tools to apply edits directly to the draft instead of replying with raw JSON unless the user explicitly asks for it.',
    'Preserve the existing character intent unless the user asks for a larger rewrite.',
    'Do not invent unsupported top-level fields or break the character card structure.',
    'After making edits, explain what changed and what still might need review.',
    `Current character name: ${characterName}.`,
    generalCharacterIdea?.trim() ? `General character idea from the editor: ${generalCharacterIdea.trim()}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

export function createCharacterAgent({
  card,
  apiKey,
  generationSettings,
  shouldSendDisabledSamplers = false,
  generalCharacterIdea = '',
  store,
}: iCreateCharacterAgentOptions) {
  const tools = createCharacterAgentTools(store);
  const model = createCharacterLanguageModel({
    endpoint: generationSettings.endpoint,
    apiKey,
    model: generationSettings.model,
    topK: generationSettings.topK,
    minP: generationSettings.minP,
    shouldSendDisabledSamplers,
  });
  const system = buildCharacterAgentInstructions({
    card,
    generalCharacterIdea,
  });

  return {
    generate: async (
      messages: ModelMessage[],
      options: { maxSteps: number; modelSettings: iCharacterAgentModelSettings },
    ) =>
      generateText({
        model,
        system,
        messages,
        tools,
        stopWhen: stepCountIs(options.maxSteps),
        maxOutputTokens: options.modelSettings.maxOutputTokens,
        temperature: options.modelSettings.temperature,
        topP: options.modelSettings.topP,
        frequencyPenalty: options.modelSettings.frequencyPenalty,
        presencePenalty: options.modelSettings.presencePenalty,
      }),
  };
}
