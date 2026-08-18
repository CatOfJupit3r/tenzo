import type { iEnhanceTemplateOptions } from '../../hooks/use-template-enhancement';
import { EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS, toPromptExampleCharacter } from '../cards/example-characters';
import type { ExampleCharacterContextFieldKey, iStoredExampleCharacter } from '../cards/example-characters';
import type { iFieldTemplateViewModel } from '../cards/field-templates';

export interface iTemplateEnhancementRequestInput {
  targetTemplate: iFieldTemplateViewModel;
  candidateContent: string | null;
  shouldIncludeCurrentTemplate: boolean;
  selectedTemplateIds: readonly string[];
  fieldTemplates: readonly iFieldTemplateViewModel[];
  exampleCharacters: readonly iStoredExampleCharacter[];
  selectedExampleFieldKeys: Readonly<Record<string, readonly ExampleCharacterContextFieldKey[]>>;
  guidance: string;
}

export function buildTemplateEnhancementRequest({
  targetTemplate,
  candidateContent,
  shouldIncludeCurrentTemplate,
  selectedTemplateIds,
  fieldTemplates,
  exampleCharacters,
  selectedExampleFieldKeys,
  guidance,
}: iTemplateEnhancementRequestInput): iEnhanceTemplateOptions {
  return {
    targetTemplate: candidateContent === null ? targetTemplate : { ...targetTemplate, content: candidateContent },
    shouldIncludeCurrentTemplate,
    referenceTemplates: selectedTemplateIds.flatMap((templateId) => {
      const template = fieldTemplates.find((candidate) => candidate.id === templateId);
      return template ? [template] : [];
    }),
    exampleCharacters: exampleCharacters.flatMap((exampleCharacter) => {
      const includedFieldKeys = selectedExampleFieldKeys[exampleCharacter.id] ?? [];
      return includedFieldKeys.length > 0
        ? [
            toPromptExampleCharacter({
              ...exampleCharacter,
              includedFieldKeys: includedFieldKeys.filter((fieldKey) =>
                EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS.includes(fieldKey),
              ),
            }),
          ]
        : [];
    }),
    guidance,
  };
}
