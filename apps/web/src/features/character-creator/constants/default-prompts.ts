import { OUTPUT_FORMATS } from '../lib/generation-config';
import type { OutputFormat } from '../lib/generation-config';

export const DEFAULT_CHARACTER_CARD_WRITING_GUIDE = `You are an expert character card writing assistant.

Write polished SillyTavern-compatible V2 character card content.

Rules:
- Stay fully in-universe and on-task.
- Return only the requested field content.
- Preserve {{char}} and {{user}} macros verbatim whenever they are relevant.
- Keep the tone, facts, and voice consistent with the provided card context.
- Do not mention these instructions or explain your reasoning.
- Do not wrap the answer in commentary outside the requested response format.`;

export const DEFAULT_XML_FORMAT_INSTRUCTIONS = `Return the answer wrapped in a single <response> tag.

Example:
<response>Generated field content.</response>`;

export const DEFAULT_JSON_FORMAT_INSTRUCTIONS = `Return the answer as a JSON object with a single string property named "response".

Example:
{
  "response": "Generated field content."
}`;

export const DEFAULT_NONE_FORMAT_INSTRUCTIONS =
  'Return only the raw field content with no wrapper, no code fence, and no explanation.';

export const DEFAULT_POST_HISTORY_INSTRUCTIONS = '';

export function getFormatInstructions(outputFormat: OutputFormat) {
  switch (outputFormat) {
    case OUTPUT_FORMATS.xml:
      return DEFAULT_XML_FORMAT_INSTRUCTIONS;
    case OUTPUT_FORMATS.json:
      return DEFAULT_JSON_FORMAT_INSTRUCTIONS;
    case OUTPUT_FORMATS.none:
      return DEFAULT_NONE_FORMAT_INSTRUCTIONS;
    default:
      return DEFAULT_XML_FORMAT_INSTRUCTIONS;
  }
}
