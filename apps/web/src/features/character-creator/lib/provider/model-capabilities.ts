import { em } from 'enumwaii';
import { z } from 'zod';

export const MODEL_CAPABILITY_ENUM = em(['STRUCTURED_OUTPUT', 'TOOL_CALLING']);
export const MODEL_CAPABILITIES = MODEL_CAPABILITY_ENUM.enum;
export const MODEL_CAPABILITY_SCHEMA = z.enum(MODEL_CAPABILITIES);

export type ModelCapability = z.infer<typeof MODEL_CAPABILITY_SCHEMA>;

export const MODEL_COMPATIBILITY_STATUS_ENUM = em(['COMPATIBLE', 'INCOMPATIBLE', 'UNKNOWN']);
export const MODEL_COMPATIBILITY_STATUSES = MODEL_COMPATIBILITY_STATUS_ENUM.enum;
export const MODEL_COMPATIBILITY_STATUS_SCHEMA = z.enum(MODEL_COMPATIBILITY_STATUSES);

export type ModelCompatibilityStatus = z.infer<typeof MODEL_COMPATIBILITY_STATUS_SCHEMA>;

export interface iModelCapabilities {
  hasStructuredOutput: boolean;
  hasToolCalling: boolean;
  hasJointStructuredOutputAndToolCalling: boolean;
}

const MODEL_CAPABILITY_READERS = MODEL_CAPABILITY_ENUM.derive<(capabilities: iModelCapabilities) => boolean>()(
  [MODEL_CAPABILITIES.STRUCTURED_OUTPUT, (capabilities) => capabilities.hasStructuredOutput],
  [MODEL_CAPABILITIES.TOOL_CALLING, (capabilities) => capabilities.hasToolCalling],
);

export function hasModelCapability(capabilities: iModelCapabilities, capability: ModelCapability) {
  return MODEL_CAPABILITY_READERS.get(capability)(capabilities);
}

export interface iModelProviderOption {
  slug: string;
  name: string;
  capabilities: iModelCapabilities;
}

const OPENAI_CAPABILITY_PARAMETER_ENUM = em({
  RESPONSE_FORMAT: 'response_format',
  STRUCTURED_OUTPUTS: 'structured_outputs',
  TOOLS: 'tools',
});
const OPENAI_CAPABILITY_PARAMETERS = OPENAI_CAPABILITY_PARAMETER_ENUM.enum;
const OPENAI_PARAMETER_CAPABILITIES = OPENAI_CAPABILITY_PARAMETER_ENUM.deriveTo(
  MODEL_CAPABILITY_ENUM,
  [OPENAI_CAPABILITY_PARAMETERS.RESPONSE_FORMAT, MODEL_CAPABILITIES.STRUCTURED_OUTPUT],
  [OPENAI_CAPABILITY_PARAMETERS.STRUCTURED_OUTPUTS, MODEL_CAPABILITIES.STRUCTURED_OUTPUT],
  [OPENAI_CAPABILITY_PARAMETERS.TOOLS, MODEL_CAPABILITIES.TOOL_CALLING],
);

export function readModelCapabilities(supportedParameters: unknown): iModelCapabilities | null {
  if (!Array.isArray(supportedParameters)) {
    return null;
  }

  const capabilities = new Set<ModelCapability>();

  supportedParameters.forEach((parameter) => {
    if (!OPENAI_CAPABILITY_PARAMETER_ENUM.is(parameter)) {
      return;
    }

    capabilities.add(OPENAI_PARAMETER_CAPABILITIES.get(parameter));
  });

  const hasStructuredOutput = capabilities.has(MODEL_CAPABILITIES.STRUCTURED_OUTPUT);
  const hasToolCalling = capabilities.has(MODEL_CAPABILITIES.TOOL_CALLING);
  return {
    hasStructuredOutput,
    hasToolCalling,
    hasJointStructuredOutputAndToolCalling: hasStructuredOutput && hasToolCalling,
  };
}

export function mergeModelCapabilities(values: readonly iModelCapabilities[]): iModelCapabilities | null {
  if (values.length === 0) {
    return null;
  }

  return {
    hasStructuredOutput: values.some((capabilities) => capabilities.hasStructuredOutput),
    hasToolCalling: values.some((capabilities) => capabilities.hasToolCalling),
    hasJointStructuredOutputAndToolCalling: values.some(
      (capabilities) => capabilities.hasJointStructuredOutputAndToolCalling,
    ),
  };
}

export function getRequiredModelCapabilities(): ModelCapability[] {
  return [MODEL_CAPABILITIES.STRUCTURED_OUTPUT];
}

export function getModelCompatibilityStatus(capabilities: iModelCapabilities | null): ModelCompatibilityStatus {
  if (!capabilities) {
    return MODEL_COMPATIBILITY_STATUSES.UNKNOWN;
  }

  const hasRequiredCapabilities = getRequiredModelCapabilities().every((capability) =>
    hasModelCapability(capabilities, capability),
  );

  return hasRequiredCapabilities ? MODEL_COMPATIBILITY_STATUSES.COMPATIBLE : MODEL_COMPATIBILITY_STATUSES.INCOMPATIBLE;
}
