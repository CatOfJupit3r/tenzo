import type { iPromptExampleCharacter } from './generation-contracts';
import { PromptFormatter } from './prompt-formatting';
import type { SeededRandom } from './seeded-random';

export const MAX_EXAMPLE_CONTEXT_CHARACTERS = 6_000;

export const EXAMPLE_CONTEXT_HEADER = [
  'Reference characters (format, depth, and quality references only):',
  'Do not reuse or closely paraphrase their names, phrasing, sentence structures, or plot elements.',
].join('\n');

export interface iExampleContextSummary {
  section: string;
  totalCharacters: number;
  usedCharacters: number;
  omittedCharacters: number;
  isTruncated: boolean;
}

const APPROXIMATE_CHARACTERS_PER_TOKEN = 4;
const EXAMPLE_CONTEXT_INPUT_SHARE = 0.6;
const EXAMPLE_CONTEXT_TOKEN_RESERVE = 1_024;
const MAX_DYNAMIC_EXAMPLE_CONTEXT_CHARACTERS = 48_000;
const MIN_EXAMPLE_CONTEXT_CHARACTERS = 2_000;

export interface iBuildExampleContextSummaryOptions {
  exampleCharacters: iPromptExampleCharacter[];
  maxCharacters?: number;
  /** When provided, example order is shuffled deterministically from the seeded source. */
  random?: SeededRandom;
}

export class ExampleContextService {
  constructor(private readonly formatter: PromptFormatter = new PromptFormatter()) {}

  getCharacterBudget(contextSize: number, maxTokens: number): number {
    const availableInputTokens = Math.max(512, contextSize - maxTokens - EXAMPLE_CONTEXT_TOKEN_RESERVE);
    const estimatedCharacters = Math.floor(
      availableInputTokens * APPROXIMATE_CHARACTERS_PER_TOKEN * EXAMPLE_CONTEXT_INPUT_SHARE,
    );

    return Math.max(
      MIN_EXAMPLE_CONTEXT_CHARACTERS,
      Math.min(MAX_DYNAMIC_EXAMPLE_CONTEXT_CHARACTERS, estimatedCharacters),
    );
  }

  buildSummary({
    exampleCharacters,
    maxCharacters = MAX_EXAMPLE_CONTEXT_CHARACTERS,
    random,
  }: iBuildExampleContextSummaryOptions): iExampleContextSummary {
    const orderedExamples = random ? random.shuffle(exampleCharacters) : exampleCharacters;
    const nonEmptyExamples = orderedExamples
      .map((exampleCharacter) => this.formatCharacterSnapshot(exampleCharacter))
      .filter((snapshot) => snapshot.length > 0);

    if (nonEmptyExamples.length === 0) {
      return {
        section: '',
        totalCharacters: 0,
        usedCharacters: 0,
        omittedCharacters: 0,
        isTruncated: false,
      };
    }

    const exampleBlocks = nonEmptyExamples.map((snapshotLines, index) => ({
      heading: `Example ${index + 1}:`,
      snapshotLines,
    }));
    const totalSourceCharacters = exampleBlocks.reduce(
      (sum, block) => sum + block.snapshotLines.reduce((lineSum, line) => lineSum + line.length, 0),
      0,
    );

    const fullSection = [
      EXAMPLE_CONTEXT_HEADER,
      ...exampleBlocks.map((block) => [block.heading, this.formatter.formatBulletList(block.snapshotLines)].join('\n')),
    ].join('\n\n');

    if (fullSection.length <= maxCharacters) {
      return {
        section: fullSection,
        totalCharacters: totalSourceCharacters,
        usedCharacters: totalSourceCharacters,
        omittedCharacters: 0,
        isTruncated: false,
      };
    }

    return this.buildTruncatedSummary(exampleBlocks, maxCharacters, totalSourceCharacters);
  }

  private buildTruncatedSummary(
    exampleBlocks: { heading: string; snapshotLines: string[] }[],
    maxCharacters: number,
    totalSourceCharacters: number,
  ): iExampleContextSummary {
    let truncatedSection = EXAMPLE_CONTEXT_HEADER;
    let usedSourceCharacters = 0;

    for (const [index, block] of exampleBlocks.entries()) {
      let hasStartedBlock = false;

      for (const snapshotLine of block.snapshotLines) {
        const linePrefix = hasStartedBlock ? '\n- ' : `\n\nExample ${index + 1}:\n- `;
        const remainingCharacters = maxCharacters - truncatedSection.length - linePrefix.length;

        if (remainingCharacters <= 0) {
          return {
            section: truncatedSection,
            totalCharacters: totalSourceCharacters,
            usedCharacters: usedSourceCharacters,
            omittedCharacters: totalSourceCharacters - usedSourceCharacters,
            isTruncated: true,
          };
        }

        const fittedLine = this.truncateLineToFit(snapshotLine, remainingCharacters);

        if (!fittedLine) {
          return {
            section: truncatedSection,
            totalCharacters: totalSourceCharacters,
            usedCharacters: usedSourceCharacters,
            omittedCharacters: totalSourceCharacters - usedSourceCharacters,
            isTruncated: true,
          };
        }

        truncatedSection += `${linePrefix}${fittedLine.text}`;
        usedSourceCharacters += fittedLine.usedSourceCharacters;
        hasStartedBlock = true;

        if (fittedLine.isTruncated) {
          return {
            section: truncatedSection,
            totalCharacters: totalSourceCharacters,
            usedCharacters: usedSourceCharacters,
            omittedCharacters: totalSourceCharacters - usedSourceCharacters,
            isTruncated: true,
          };
        }
      }
    }

    return {
      section: truncatedSection,
      totalCharacters: totalSourceCharacters,
      usedCharacters: usedSourceCharacters,
      omittedCharacters: totalSourceCharacters - usedSourceCharacters,
      isTruncated: usedSourceCharacters < totalSourceCharacters,
    };
  }

  private formatCharacterSnapshot(data: iPromptExampleCharacter) {
    const lines: string[] = [];

    if (data.name?.trim()) {
      lines.push(`Name: ${data.name.trim()}`);
    }

    if (data.description?.trim()) {
      lines.push(`Description: ${data.description.trim()}`);
    }

    if (data.personality?.trim()) {
      lines.push(`Personality: ${data.personality.trim()}`);
    }

    if (data.scenario?.trim()) {
      lines.push(`Scenario: ${data.scenario.trim()}`);
    }

    if (data.first_mes?.trim()) {
      lines.push(`First Message: ${data.first_mes.trim()}`);
    }

    if (data.mes_example?.trim()) {
      lines.push(`Example Dialogue: ${data.mes_example.trim()}`);
    }

    if (Array.isArray(data.alternate_greetings) && data.alternate_greetings.length > 0) {
      lines.push(
        `Alternate Greetings: ${data.alternate_greetings
          .map((greeting, index) => `[${index + 1}] ${greeting}`)
          .join(' | ')}`,
      );
    }

    if (Array.isArray(data.custom_fields) && data.custom_fields.length > 0) {
      lines.push(
        `Custom Fields: ${data.custom_fields
          .filter((field) => field.label.trim() !== '' || field.value.trim() !== '')
          .map((field) => {
            const trimmedLabel = field.label.trim();
            const trimmedValue = field.value.trim();

            return `${trimmedLabel !== '' ? trimmedLabel : 'Untitled Field'} = ${trimmedValue !== '' ? trimmedValue : '(empty)'}`;
          })
          .join(' | ')}`,
      );
    }

    return lines;
  }

  private truncateLineToFit(line: string, maxLength: number) {
    if (line.length <= maxLength) {
      return {
        text: line,
        usedSourceCharacters: line.length,
        isTruncated: false,
      };
    }

    if (maxLength <= 3) {
      return null;
    }

    const maxSliceLength = Math.max(1, maxLength - 3);
    let slice = line.slice(0, maxSliceLength);
    const lastWhitespaceIndex = slice.lastIndexOf(' ');

    if (lastWhitespaceIndex >= Math.floor(maxSliceLength * 0.6)) {
      slice = slice.slice(0, lastWhitespaceIndex);
    }

    slice = slice.trimEnd();

    if (slice === '') {
      return null;
    }

    return {
      text: `${slice}...`,
      usedSourceCharacters: slice.length,
      isTruncated: true,
    };
  }
}
