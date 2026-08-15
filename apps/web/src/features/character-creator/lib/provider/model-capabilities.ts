import { z } from 'zod';

import { CHARACTER_ASSISTANT_GENERATION_MODES } from '../assistant/character-assistant-generation-mode';
import type { CharacterAssistantGenerationMode } from '../assistant/character-assistant-generation-mode';

export const MODEL_CAPABILITY_SCHEMA = z.enum(['structured-output', 'tool-calling']);
export const MODEL_CAPABILITIES = MODEL_CAPABILITY_SCHEMA.enum;
export type ModelCapability = z.infer<typeof MODEL_CAPABILITY_SCHEMA>;

export const MODEL_COMPATIBILITY_STATUS_SCHEMA = z.enum(['compatible', 'incompatible', 'unknown']);
export const MODEL_COMPATIBILITY_STATUSES = MODEL_COMPATIBILITY_STATUS_SCHEMA.enum;
export type ModelCompatibilityStatus = z.infer<typeof MODEL_COMPATIBILITY_STATUS_SCHEMA>;

export interface iModelCapabilities extends Record<ModelCapability, boolean> {
  hasJointStructuredOutputAndToolCalling: boolean;
}

export interface iModelProviderOption {
  slug: string;
  name: string;
  capabilities: iModelCapabilities;
}

const OPENAI_PARAMETER_CAPABILITIES = {
  response_format: MODEL_CAPABILITIES['structured-output'],
  structured_outputs: MODEL_CAPABILITIES['structured-output'],
  tools: MODEL_CAPABILITIES['tool-calling'],
} satisfies Record<string, ModelCapability>;

export function readModelCapabilities(supportedParameters: unknown): iModelCapabilities | null {
  if (!Array.isArray(supportedParameters)) {
    return null;
  }

  const capabilities: iModelCapabilities = {
    [MODEL_CAPABILITIES['structured-output']]: false,
    [MODEL_CAPABILITIES['tool-calling']]: false,
    hasJointStructuredOutputAndToolCalling: false,
  };

  supportedParameters.forEach((parameter) => {
    if (typeof parameter !== 'string') {
      return;
    }

    const capability = OPENAI_PARAMETER_CAPABILITIES[parameter as keyof typeof OPENAI_PARAMETER_CAPABILITIES];
    if (capability) {
      capabilities[capability] = true;
    }
  });

  capabilities.hasJointStructuredOutputAndToolCalling =
    capabilities[MODEL_CAPABILITIES['structured-output']] && capabilities[MODEL_CAPABILITIES['tool-calling']];

  return capabilities;
}

export function mergeModelCapabilities(values: readonly iModelCapabilities[]): iModelCapabilities | null {
  if (values.length === 0) {
    return null;
  }

  return {
    [MODEL_CAPABILITIES['structured-output']]: values.some(
      (capabilities) => capabilities[MODEL_CAPABILITIES['structured-output']],
    ),
    [MODEL_CAPABILITIES['tool-calling']]: values.some(
      (capabilities) => capabilities[MODEL_CAPABILITIES['tool-calling']],
    ),
    hasJointStructuredOutputAndToolCalling: values.some(
      (capabilities) => capabilities.hasJointStructuredOutputAndToolCalling,
    ),
  };
}

export function getRequiredModelCapabilities(
  assistantGenerationMode: CharacterAssistantGenerationMode,
): ModelCapability[] {
  return assistantGenerationMode === CHARACTER_ASSISTANT_GENERATION_MODES['tool-call']
    ? [MODEL_CAPABILITIES['structured-output'], MODEL_CAPABILITIES['tool-calling']]
    : [MODEL_CAPABILITIES['structured-output']];
}

export function getModelCompatibilityStatus(
  capabilities: iModelCapabilities | null,
  assistantGenerationMode: CharacterAssistantGenerationMode,
): ModelCompatibilityStatus {
  if (!capabilities) {
    return MODEL_COMPATIBILITY_STATUSES.unknown;
  }

  const hasRequiredCapabilities =
    assistantGenerationMode === CHARACTER_ASSISTANT_GENERATION_MODES['tool-call']
      ? capabilities.hasJointStructuredOutputAndToolCalling
      : getRequiredModelCapabilities(assistantGenerationMode).every((capability) => capabilities[capability]);

  return hasRequiredCapabilities ? MODEL_COMPATIBILITY_STATUSES.compatible : MODEL_COMPATIBILITY_STATUSES.incompatible;
}
