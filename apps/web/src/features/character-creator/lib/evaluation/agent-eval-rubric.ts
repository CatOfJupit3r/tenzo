import type { CharacterTextFieldKey } from '../cards/card-schema';
import { AGENT_EVAL_RUBRIC_DIMENSIONS } from './agent-eval-contracts';
import type { AgentEvalRubricDimension } from './agent-eval-contracts';

export interface iAgentEvalFieldRubric {
  purpose: string;
  usefulInformationExamples: readonly string[];
  paddingSignals: readonly string[];
  emphasizedDimensions: readonly AgentEvalRubricDimension[];
}

export const AGENT_EVAL_SCORE_ANCHORS = {
  1: 'Fails the requested purpose or contradicts confirmed input.',
  2: 'Partially usable but generic, incomplete, repetitive, or difficult to apply.',
  3: 'Usable and faithful with enough specific material for the field purpose.',
  4: 'Strong, specific, coherent, and immediately useful with only minor weaknesses.',
  5: 'Exceptional execution of the field purpose without padding or avoidable repetition.',
} as const;

export const AGENT_EVAL_FIELD_RUBRICS = {
  name: {
    purpose: 'Provide a memorable identity label consistent with the premise and tone.',
    usefulInformationExamples: ['distinctive fit with setting', 'pronounceable roleplay identity'],
    paddingSignals: ['titles or biography inserted into the name'],
    emphasizedDimensions: [AGENT_EVAL_RUBRIC_DIMENSIONS.fidelity, AGENT_EVAL_RUBRIC_DIMENSIONS.voice],
  },
  description: {
    purpose: 'Establish identity, durable facts, appearance, presence, and relevant history.',
    usefulInformationExamples: ['specific physical detail', 'durable role or history', 'sensory presence'],
    paddingSignals: ['trait list repeated from personality', 'scene narration repeated from scenario'],
    emphasizedDimensions: [
      AGENT_EVAL_RUBRIC_DIMENSIONS.specificity,
      AGENT_EVAL_RUBRIC_DIMENSIONS.completeness,
      AGENT_EVAL_RUBRIC_DIMENSIONS['non-repetition'],
    ],
  },
  personality: {
    purpose: 'Explain behavioral tendencies, motivations, contradictions, boundaries, and stress responses.',
    usefulInformationExamples: ['observable behavior', 'motivation', 'flaw with consequence', 'stress response'],
    paddingSignals: ['synonym lists', 'appearance recap', 'unsupported adjective stacking'],
    emphasizedDimensions: [
      AGENT_EVAL_RUBRIC_DIMENSIONS.specificity,
      AGENT_EVAL_RUBRIC_DIMENSIONS.coherence,
      AGENT_EVAL_RUBRIC_DIMENSIONS['roleplay-usability'],
    ],
  },
  scenario: {
    purpose: 'Define the active situation, relationship context, stakes, and immediate roleplay opportunities.',
    usefulInformationExamples: ['current location', 'active pressure', 'relationship state', 'open decision'],
    paddingSignals: ['full biography recap', 'personality summary with no active situation'],
    emphasizedDimensions: [
      AGENT_EVAL_RUBRIC_DIMENSIONS['roleplay-usability'],
      AGENT_EVAL_RUBRIC_DIMENSIONS.coherence,
      AGENT_EVAL_RUBRIC_DIMENSIONS.fidelity,
    ],
  },
  first_mes: {
    purpose: 'Open an actionable scene in voice while preserving user agency and required macros.',
    usefulInformationExamples: ['actionable hook', 'distinct voice', 'space for user response'],
    paddingSignals: ['scenario restatement', 'controlling user thoughts or actions'],
    emphasizedDimensions: [
      AGENT_EVAL_RUBRIC_DIMENSIONS['roleplay-usability'],
      AGENT_EVAL_RUBRIC_DIMENSIONS.voice,
      AGENT_EVAL_RUBRIC_DIMENSIONS.format,
    ],
  },
  mes_example: {
    purpose: 'Demonstrate voice, reactions, pacing, and interaction patterns through playable dialogue.',
    usefulInformationExamples: ['multiple interaction turns', 'behavior shown in dialogue', 'distinct speech pattern'],
    paddingSignals: ['trait summary outside dialogue', 'near-copy of the first message'],
    emphasizedDimensions: [
      AGENT_EVAL_RUBRIC_DIMENSIONS.voice,
      AGENT_EVAL_RUBRIC_DIMENSIONS['roleplay-usability'],
      AGENT_EVAL_RUBRIC_DIMENSIONS.format,
    ],
  },
  creator_notes: {
    purpose: 'Give concise creator-facing usage guidance that does not leak into roleplay prose.',
    usefulInformationExamples: ['intended use', 'content boundary', 'configuration note'],
    paddingSignals: ['card prose duplicated verbatim'],
    emphasizedDimensions: [AGENT_EVAL_RUBRIC_DIMENSIONS.fidelity, AGENT_EVAL_RUBRIC_DIMENSIONS.format],
  },
  system_prompt: {
    purpose: 'Define stable behavior instructions and boundaries for the character runtime.',
    usefulInformationExamples: ['behavioral invariant', 'boundary', 'macro-aware instruction'],
    paddingSignals: ['biography unrelated to runtime behavior'],
    emphasizedDimensions: [AGENT_EVAL_RUBRIC_DIMENSIONS.fidelity, AGENT_EVAL_RUBRIC_DIMENSIONS.format],
  },
  post_history_instructions: {
    purpose: 'Apply concise late-context behavior guidance without contradicting the card.',
    usefulInformationExamples: ['priority behavior', 'response constraint'],
    paddingSignals: ['full system prompt repetition'],
    emphasizedDimensions: [AGENT_EVAL_RUBRIC_DIMENSIONS.coherence, AGENT_EVAL_RUBRIC_DIMENSIONS.format],
  },
  creator: {
    purpose: 'Identify the creator without adding character prose.',
    usefulInformationExamples: ['creator name'],
    paddingSignals: ['biographical character content'],
    emphasizedDimensions: [AGENT_EVAL_RUBRIC_DIMENSIONS.format],
  },
  character_version: {
    purpose: 'Identify the card revision in a compact, consistent form.',
    usefulInformationExamples: ['semantic or creator-defined revision'],
    paddingSignals: ['change log embedded in the version'],
    emphasizedDimensions: [AGENT_EVAL_RUBRIC_DIMENSIONS.format],
  },
} satisfies Record<CharacterTextFieldKey, iAgentEvalFieldRubric>;
