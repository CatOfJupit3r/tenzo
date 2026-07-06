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

export const DEFAULT_XML_CONTINUATION_INSTRUCTIONS = `Your reply has already been started for you with an opening <response> tag followed by the existing field value. That partial reply is the last message in this conversation — you are not starting a new turn, you are finishing that one.

Write only the remaining text that comes next, as a direct, seamless continuation of the existing value.
- Do not repeat or restate any of the existing text.
- Do not output another <response> tag.
- Do not output a closing </response> tag; it will be added for you.`;

export const DEFAULT_JSON_CONTINUATION_INSTRUCTIONS = `Your reply has already been started for you as an open JSON string: {"response":"<existing value>. That partial reply is the last message in this conversation — you are not starting a new turn, you are finishing that one.

Write only the remaining text that comes next, as a direct, seamless continuation of the existing value, escaped as valid JSON string content.
- Do not repeat or restate any of the existing text.
- Do not reopen the JSON object or the "response" key.
- Do not add the closing quote or brace; it will be added for you.`;

export const DEFAULT_NONE_CONTINUATION_INSTRUCTIONS = `Your reply has already been started for you with the existing field value as plain text. That partial reply is the last message in this conversation — you are not starting a new turn, you are finishing that one.

Write only the remaining text that comes next, as a direct, seamless continuation of the existing value.
- Do not repeat or restate any of the existing text.
- Do not add any wrapper, code fence, or explanation.`;

export function getContinuationFormatInstructions(outputFormat: OutputFormat) {
  switch (outputFormat) {
    case OUTPUT_FORMATS.xml:
      return DEFAULT_XML_CONTINUATION_INSTRUCTIONS;
    case OUTPUT_FORMATS.json:
      return DEFAULT_JSON_CONTINUATION_INSTRUCTIONS;
    case OUTPUT_FORMATS.none:
      return DEFAULT_NONE_CONTINUATION_INSTRUCTIONS;
    default:
      return DEFAULT_XML_CONTINUATION_INSTRUCTIONS;
  }
}
