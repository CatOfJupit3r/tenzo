import { Card, CardContent, CardHeader, CardTitle } from '@~/components/ui/card';

import { AlternateGreetings } from '../components/alternate-greetings';
import { CharacterField } from '../components/character-field';
import { CustomFields } from '../components/custom-fields';
import { TagsInput } from '../components/tags-input';
import { CORE_FIELD_CONFIGS, METADATA_FIELD_CONFIGS, PROMPT_OVERRIDE_FIELD_CONFIGS } from '../constants/field-config';
import { useCharacterSession } from '../hooks/use-character-session';

export function CharacterCreatorPage() {
  const {
    card,
    updateField,
    updateTags,
    addGreeting,
    updateGreeting,
    removeGreeting,
    reorderGreetings,
    addCustomField,
    updateCustomField,
    removeCustomField,
  } = useCharacterSession();

  const { data } = card;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-[0.3em] text-muted-foreground uppercase">Character Card Creator</p>
        <CharacterField
          fieldId="character-name"
          label="Name"
          value={data.name}
          rows={1}
          onValueChange={(value) => updateField('name', value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {CORE_FIELD_CONFIGS.map((config) => (
            <CharacterField
              key={config.key}
              fieldId={`character-${config.key}`}
              label={config.label}
              value={data[config.key]}
              rows={config.rows}
              hint={config.hint}
              onValueChange={(value) => updateField(config.key, value)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alternate Greetings</CardTitle>
        </CardHeader>
        <CardContent>
          <AlternateGreetings
            greetings={data.alternate_greetings}
            onAdd={addGreeting}
            onChange={updateGreeting}
            onRemove={removeGreeting}
            onMove={reorderGreetings}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt Overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {PROMPT_OVERRIDE_FIELD_CONFIGS.map((config) => (
            <CharacterField
              key={config.key}
              fieldId={`character-${config.key}`}
              label={config.label}
              value={data[config.key]}
              rows={config.rows}
              hint={config.hint}
              onValueChange={(value) => updateField(config.key, value)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {METADATA_FIELD_CONFIGS.map((config) => (
            <CharacterField
              key={config.key}
              fieldId={`character-${config.key}`}
              label={config.label}
              value={data[config.key]}
              rows={config.rows}
              hint={config.hint}
              onValueChange={(value) => updateField(config.key, value)}
            />
          ))}
          <TagsInput value={data.tags} onChange={updateTags} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFields
            fields={data.extensions.custom_fields}
            onAdd={addCustomField}
            onUpdate={updateCustomField}
            onRemove={removeCustomField}
          />
        </CardContent>
      </Card>
    </div>
  );
}
