import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';

import { createCharacterLanguageModel } from './ai-sdk-text-generation';
import type { CharacterCard } from './card-schema';
import { createCharacterAgentTools } from './character-agent-tools';

interface iCharacterAgentModelSettings {
  endpoint: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  topK: number;
  minP: number;
}

interface iCreateCharacterAgentStore {
  getDraftCard: () => CharacterCard;
  replaceDraftCard: (card: CharacterCard) => void;
  appendToolEvent: Parameters<typeof createCharacterAgentTools>[0]['appendToolEvent'];
}

interface iCreateCharacterAgentMastraOptions {
  card: CharacterCard;
  apiKey: string;
  generationSettings: iCharacterAgentModelSettings;
  shouldSendDisabledSamplers?: boolean;
  generalCharacterIdea?: string;
  store: iCreateCharacterAgentStore;
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

export function createCharacterAgentMastra({
  card,
  apiKey,
  generationSettings,
  shouldSendDisabledSamplers = false,
  generalCharacterIdea = '',
  store,
}: iCreateCharacterAgentMastraOptions) {
  const agent = new Agent({
    id: 'character-agent',
    name: 'Character Agent',
    instructions: buildCharacterAgentInstructions({
      card,
      generalCharacterIdea,
    }),
    model: createCharacterLanguageModel({
      endpoint: generationSettings.endpoint,
      apiKey,
      model: generationSettings.model,
      topK: generationSettings.topK,
      minP: generationSettings.minP,
      shouldSendDisabledSamplers,
    }),
    tools: createCharacterAgentTools(store) as ToolsInput,
  });

  const mastra = new Mastra({
    agents: {
      characterAgent: agent,
    },
  });

  return {
    mastra,
    agent: mastra.getAgent('characterAgent'),
  };
}
