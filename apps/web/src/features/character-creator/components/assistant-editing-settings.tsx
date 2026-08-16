import { Switch } from '@~/components/ui/switch';

import { CORE_FIELD_CONFIGS, METADATA_FIELD_CONFIGS, PROMPT_OVERRIDE_FIELD_CONFIGS } from '../constants/field-config';
import type { CharacterAssistantFieldEditing } from '../lib/generation/generation-config';
import { CHARACTER_EDIT_FIELD_KEYS } from '../lib/proposals/character-edit-proposal';
import type { CharacterEditFieldKey } from '../lib/proposals/character-edit-proposal';

const ASSISTANT_EDITABLE_FIELDS = [
  ...CORE_FIELD_CONFIGS.map(({ key, label }) => ({ key, label })),
  ...PROMPT_OVERRIDE_FIELD_CONFIGS.map(({ key, label }) => ({ key, label })),
  ...METADATA_FIELD_CONFIGS.map(({ key, label }) => ({ key, label })),
  { key: CHARACTER_EDIT_FIELD_KEYS.tags, label: 'Tags' },
  { key: CHARACTER_EDIT_FIELD_KEYS.alternate_greetings, label: 'Alternate Greetings' },
  { key: CHARACTER_EDIT_FIELD_KEYS.custom_fields, label: 'Custom Fields' },
  { key: CHARACTER_EDIT_FIELD_KEYS.character_book, label: 'Character Book' },
] satisfies { key: CharacterEditFieldKey; label: string }[];

export function AssistantEditingSettings({
  fieldShouldAllowAssistantEditing,
  onChange,
}: {
  fieldShouldAllowAssistantEditing: Readonly<CharacterAssistantFieldEditing>;
  onChange: (fieldKey: CharacterEditFieldKey, shouldAllowEditing: boolean) => undefined;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Fields the AI assistant can edit</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Disabled fields are ignored in assistant proposals. Their Generate with AI actions remain available.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ASSISTANT_EDITABLE_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <label className="text-sm" htmlFor={`assistant-editing-${field.key}`}>
              {field.label}
            </label>
            <Switch
              id={`assistant-editing-${field.key}`}
              checked={fieldShouldAllowAssistantEditing[field.key]}
              aria-label={`Allow AI assistant to edit ${field.label}`}
              onCheckedChange={(isChecked) => onChange(field.key, isChecked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
