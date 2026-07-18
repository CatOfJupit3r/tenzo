import { extractJsonMiddleware, generateText, Output, wrapLanguageModel } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import { z } from 'zod';

interface iGenerateValidatedObjectOptions<T> {
  model: Exclude<LanguageModel, string>;
  schema: z.ZodType<T>;
  schemaName: string;
  schemaDescription: string;
  system: string;
  prompt?: string;
  messages?: ModelMessage[];
  maxOutputTokens: number;
  temperature: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  abortSignal?: AbortSignal;
}

export function extractFirstJsonValue(content: string) {
  const objectStart = content.indexOf('{');
  const arrayStart = content.indexOf('[');
  let start = Math.min(objectStart, arrayStart);

  if (objectStart < 0) {
    start = arrayStart;
  } else if (arrayStart < 0) {
    start = objectStart;
  }

  if (start < 0) {
    throw new Error('The model response did not contain JSON.');
  }

  const stack: string[] = [];
  let isInsideString = false;
  let isEscaped = false;

  for (let index = start; index < content.length; index += 1) {
    const character = content[index];

    if (isInsideString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === '\\') {
        isEscaped = true;
      } else if (character === '"') {
        isInsideString = false;
      }
      continue;
    }

    if (character === '"') {
      isInsideString = true;
      continue;
    }

    if (character === '{' || character === '[') {
      stack.push(character);
      continue;
    }

    if (character !== '}' && character !== ']') {
      continue;
    }

    const openingCharacter = stack.pop();
    const isMatchingPair =
      (openingCharacter === '{' && character === '}') || (openingCharacter === '[' && character === ']');

    if (!isMatchingPair) {
      throw new Error('The model response contained malformed JSON delimiters.');
    }

    if (stack.length === 0) {
      return content.slice(start, index + 1);
    }
  }

  throw new Error('The model response contained incomplete JSON.');
}

function buildPromptInput(prompt?: string, messages?: ModelMessage[]) {
  if (messages) {
    return { messages } as const;
  }

  if (prompt) {
    return { prompt } as const;
  }

  throw new Error('Structured generation requires a prompt or messages.');
}

export async function generateValidatedObject<T>({
  model,
  schema,
  schemaName,
  schemaDescription,
  system,
  prompt,
  messages,
  maxOutputTokens,
  temperature,
  topP,
  frequencyPenalty,
  presencePenalty,
  abortSignal,
}: iGenerateValidatedObjectOptions<T>): Promise<T> {
  const promptInput = buildPromptInput(prompt, messages);
  const modelWithJsonExtraction = wrapLanguageModel({
    model,
    middleware: extractJsonMiddleware({ transform: extractFirstJsonValue }),
  });
  const settings = {
    maxOutputTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    abortSignal,
  };

  try {
    const result = await generateText({
      model: modelWithJsonExtraction,
      output: Output.object({
        schema,
        name: schemaName,
        description: schemaDescription,
      }),
      system,
      ...promptInput,
      ...settings,
    });

    return schema.parse(result.output);
  } catch (structuredOutputError) {
    const jsonSchema = JSON.stringify(z.toJSONSchema(schema));

    try {
      const result = await generateText({
        model,
        system: `${system}\nReturn only one JSON value matching this JSON Schema: ${jsonSchema}`,
        ...promptInput,
        ...settings,
      });
      const parsedValue = JSON.parse(extractFirstJsonValue(result.text)) as unknown;
      return schema.parse(parsedValue);
    } catch (fallbackError) {
      throw new AggregateError(
        [structuredOutputError, fallbackError],
        'The model did not return valid structured JSON. Try a more capable model or disable incompatible sampling settings.',
      );
    }
  }
}
