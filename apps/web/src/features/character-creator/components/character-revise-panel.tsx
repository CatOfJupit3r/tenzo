import { useMemo, useState } from 'react';

import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import { SingleSelect } from '@~/components/ui/select';
import type { iOptionType } from '@~/components/ui/select';
import { Textarea } from '@~/components/ui/textarea';
import { cn } from '@~/lib/utils';

import { CORE_FIELD_CONFIGS, METADATA_FIELD_CONFIGS, PROMPT_OVERRIDE_FIELD_CONFIGS } from '../constants/field-config';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { useCharacterReviseSession } from '../hooks/use-character-revise-session';
import type { CharacterTextFieldKey } from '../lib/card-schema';
import { PROVIDER_KINDS } from '../lib/provider-health';

const REVISE_FIELD_CONFIGS = [...CORE_FIELD_CONFIGS, ...METADATA_FIELD_CONFIGS, ...PROMPT_OVERRIDE_FIELD_CONFIGS];
const DEFAULT_REVISE_FIELD_KEY = CORE_FIELD_CONFIGS[1]?.key ?? CORE_FIELD_CONFIGS[0]?.key ?? 'description';
const REVISE_FIELD_OPTIONS: iOptionType[] = REVISE_FIELD_CONFIGS.map((fieldConfig) => ({
  value: fieldConfig.key,
  label: fieldConfig.label,
  description: fieldConfig.hint,
}));

interface iCharacterReviseSessionPanelProps {
  fieldKey: CharacterTextFieldKey;
  onApplyLatestRevision: (nextValue: string) => void;
}

function CharacterReviseSessionPanel({ fieldKey, onApplyLatestRevision }: iCharacterReviseSessionPanelProps) {
  const { card, generationSettings, apiKey, connectionHealth, getStandardFieldGenerationState } =
    useCharacterCreatorContext();
  const [inputValue, setInputValue] = useState('');
  const generationState = getStandardFieldGenerationState(fieldKey);
  const fieldConfig = REVISE_FIELD_CONFIGS.find((config) => config.key === fieldKey) ?? REVISE_FIELD_CONFIGS[0];
  const { messages, sendMessage, status, stop, error, latestRevision, isConnectionConfigured } =
    useCharacterReviseSession({
      card,
      fieldKey,
      apiKey,
      generationSettings,
      shouldSendDisabledSamplers: connectionHealth.providerKind === PROVIDER_KINDS.koboldcpp,
      generalCharacterIdea: generationSettings.generalCharacterIdea,
      shouldUseGeneralCharacterIdea: generationState.shouldUseGeneralCharacterIdea,
      fieldInstruction: generationState.instructionValue,
    });
  const hasLatestRevision = latestRevision.length > 0;
  const isStreaming = status === 'submitted' || status === 'streaming';

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
      <div className="grid gap-4">
        <div className="rounded-2xl border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{fieldConfig?.label ?? 'Field'} revise chat</p>
              <p className="text-xs text-muted-foreground">
                Each reply streams a complete updated version of the selected field.
              </p>
            </div>
            {isStreaming ? (
              <Button type="button" size="sm" variant="outline" onClick={async () => stop()}>
                Stop
              </Button>
            ) : null}
          </div>

          <div className="grid max-h-96 gap-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Ask for an iterative change such as &quot;make her colder and more ceremonial&quot; or &quot;trim this
                to one short paragraph.&quot;
              </div>
            ) : null}

            {messages.map((message) => {
              const text = message.parts
                .map((part) => (part.type === 'text' ? part.text : ''))
                .join('')
                .trim();

              if (!text) {
                return null;
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                    message.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'border bg-card text-card-foreground',
                  )}
                >
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                    {message.role === 'user' ? 'You' : 'Revision'}
                  </div>
                  <div className="whitespace-pre-wrap">{text}</div>
                </div>
              );
            })}
          </div>

          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();

              if (!inputValue.trim() || !isConnectionConfigured || isStreaming) {
                return;
              }

              void sendMessage({
                text: inputValue.trim(),
              });
              setInputValue('');
            }}
          >
            <Textarea
              value={inputValue}
              rows={4}
              disabled={!isConnectionConfigured || isStreaming}
              placeholder={`Describe how ${fieldConfig?.label?.toLowerCase() ?? 'this field'} should change...`}
              onChange={(event) => setInputValue(event.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Revise chat always runs through the server route so it can stream cleanly against OpenAI-compatible
                providers.
              </p>
              <Button type="submit" size="sm" disabled={!isConnectionConfigured || !inputValue.trim() || isStreaming}>
                {isStreaming ? 'Streaming...' : 'Send revision'}
              </Button>
            </div>
          </form>
        </div>

        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        {!isConnectionConfigured ? (
          <p className="text-sm text-muted-foreground">
            Add an endpoint, model, and API key in Connection Settings before starting a revise session.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4">
        <div className="rounded-2xl border bg-background/60 p-4">
          <div className="mb-3">
            <p className="text-sm font-medium">Current field value</p>
            <p className="text-xs text-muted-foreground">
              The editor stays unchanged until you apply a streamed revision.
            </p>
          </div>
          <Textarea value={card.data[fieldKey]} rows={12} readOnly />
        </div>

        <div className="rounded-2xl border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Latest proposed revision</p>
              <p className="text-xs text-muted-foreground">
                The newest assistant reply is ready to apply back into the field.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!hasLatestRevision || latestRevision === card.data[fieldKey]}
              onClick={() => onApplyLatestRevision(latestRevision)}
            >
              Apply to field
            </Button>
          </div>
          <Textarea value={latestRevision} rows={12} readOnly placeholder="The streamed revision will appear here." />
        </div>
      </div>
    </div>
  );
}

export function CharacterRevisePanel() {
  const { updateField } = useCharacterCreatorContext();
  const [selectedFieldKey, setSelectedFieldKey] = useState<CharacterTextFieldKey>(DEFAULT_REVISE_FIELD_KEY);
  const [sessionVersion, setSessionVersion] = useState(0);
  const selectedFieldOption = useMemo(
    () => REVISE_FIELD_OPTIONS.find((option) => option.value === selectedFieldKey) ?? null,
    [selectedFieldKey],
  );

  return (
    <Card className="gap-0 overflow-hidden bg-card/95 py-0 shadow-sm">
      <CardHeader className="border-b py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle>Revise Session</CardTitle>
              <Badge variant="outline">Experimental</Badge>
            </div>
            <CardDescription>
              AI SDK chat is wired into TanStack Start for iterative field editing alongside one-shot field generation.
            </CardDescription>
          </div>

          <div className="flex min-w-64 flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <SingleSelect
                aria-label="Select revise field"
                value={selectedFieldKey}
                options={REVISE_FIELD_OPTIONS}
                onValueChange={(nextValue) => {
                  if (!nextValue) {
                    return;
                  }

                  setSelectedFieldKey(nextValue as CharacterTextFieldKey);
                  setSessionVersion((value) => value + 1);
                }}
              />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setSessionVersion((value) => value + 1)}>
              Clear chat
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <CharacterReviseSessionPanel
          key={`${selectedFieldKey}:${sessionVersion}`}
          fieldKey={selectedFieldKey}
          onApplyLatestRevision={(nextValue) => updateField(selectedFieldKey, nextValue)}
        />
        {selectedFieldOption?.description ? (
          <p className="mt-4 text-xs text-muted-foreground">{selectedFieldOption.description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
