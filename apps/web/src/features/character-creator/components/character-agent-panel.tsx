import { useMemo, useState } from 'react';

import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@~/components/ui/card';
import { Textarea } from '@~/components/ui/textarea';
import { cn } from '@~/lib/utils';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { useCharacterAgentWorkspace } from '../hooks/use-character-agent-workspace';
import { PROVIDER_KINDS } from '../lib/provider-health';

function formatSectionLabel(section: string) {
  return section.replaceAll('_', ' ');
}

export function CharacterAgentPanel() {
  const { activeCharacterId, card, replaceCard, apiKey, generationSettings, generalCharacterIdea, connectionHealth } =
    useCharacterCreatorContext();
  const [inputValue, setInputValue] = useState('');
  const {
    draftPreview,
    changedSections,
    hasDraftChanges,
    isConnectionConfigured,
    messages,
    toolEvents,
    isRunning,
    errorMessage,
    clearConversation,
    resetSessionFromCharacter,
    applyDraftToCharacter,
    sendMessage,
    isDraftInSyncWithCharacter,
  } = useCharacterAgentWorkspace({
    characterId: activeCharacterId,
    card,
    replaceCard,
    apiKey,
    generationSettings,
    generalCharacterIdea,
    shouldSendDisabledSamplers: connectionHealth.providerKind === PROVIDER_KINDS.koboldcpp,
  });

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? '',
    [messages],
  );

  return (
    <Card className="gap-0 overflow-hidden bg-card/95 py-0 shadow-sm">
      <CardHeader className="border-b py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle>Character Agent</CardTitle>
              <Badge variant="outline">Experimental</Badge>
              <Badge variant={hasDraftChanges ? 'default' : 'secondary'}>
                {hasDraftChanges ? 'Draft Changed' : 'Draft Synced'}
              </Badge>
            </div>
            <CardDescription>
              This agent keeps its session in browser-local storage, runs through a TanStack Start route, and only
              changes the live character when you apply the draft.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearConversation}
              disabled={messages.length === 0 && toolEvents.length === 0}
            >
              Clear log
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={resetSessionFromCharacter}>
              Reset draft
            </Button>
            <Button type="button" size="sm" onClick={applyDraftToCharacter} disabled={!hasDraftChanges}>
              Apply draft
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="grid gap-4">
          <div className="rounded-2xl border bg-background/60 p-4">
            <div className="mb-3 space-y-1">
              <p className="text-sm font-medium">Agent chat</p>
              <p className="text-xs text-muted-foreground">
                Ask for whole-character changes like tone shifts, continuity cleanup, or coordinated edits across
                multiple fields.
              </p>
            </div>

            <div className="grid max-h-96 gap-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Try prompts like &quot;make the whole character more playful but keep the ceremonial mood&quot; or
                  &quot;rewrite the description, personality, and first message so they feel consistent.&quot;
                </div>
              ) : null}

              {messages.map((message) => (
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
                    {message.role === 'user' ? 'You' : 'Agent'}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              ))}
            </div>

            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                if (!inputValue.trim() || isRunning || !isConnectionConfigured) {
                  return;
                }

                void sendMessage(inputValue);
                setInputValue('');
              }}
            >
              <Textarea
                value={inputValue}
                rows={4}
                disabled={isRunning || !isConnectionConfigured}
                placeholder="Describe the character-level change you want..."
                onChange={(event) => setInputValue(event.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  The browser owns the session, draft, and history while the route executes the agent statelessly.
                </p>
                <Button type="submit" size="sm" disabled={isRunning || !inputValue.trim() || !isConnectionConfigured}>
                  {isRunning ? 'Running...' : 'Run agent'}
                </Button>
              </div>
            </form>
          </div>

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {!isConnectionConfigured ? (
            <p className="text-sm text-muted-foreground">
              Add an endpoint, model, and API key in Connection Settings before starting a character-agent session.
            </p>
          ) : null}
          {latestAssistantMessage ? (
            <p className="text-xs text-muted-foreground">Latest agent note: {latestAssistantMessage}</p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border bg-background/60 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={isDraftInSyncWithCharacter ? 'secondary' : 'default'}>
                {isDraftInSyncWithCharacter ? 'No pending draft delta' : 'Pending local draft delta'}
              </Badge>
              <Badge variant="outline">{toolEvents.length} tool actions</Badge>
            </div>

            <div className="mb-3">
              <p className="text-sm font-medium">Changed sections</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {changedSections.length > 0 ? (
                  changedSections.map((section) => (
                    <Badge key={section} variant="outline">
                      {formatSectionLabel(section)}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">The draft currently matches the live character.</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Draft preview</p>
              <Textarea value={draftPreview} rows={16} readOnly />
            </div>
          </div>

          <div className="rounded-2xl border bg-background/60 p-4">
            <div className="mb-3">
              <p className="text-sm font-medium">Tool activity</p>
              <p className="text-xs text-muted-foreground">
                Each tool call updates the local draft snapshot and leaves a compact activity trail.
              </p>
            </div>

            <div className="grid max-h-80 gap-3 overflow-y-auto pr-1">
              {toolEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Tool actions will appear here after the agent starts editing the draft.
                </div>
              ) : null}

              {toolEvents.map((toolEvent) => (
                <div key={toolEvent.id} className="rounded-xl border bg-card p-3 text-sm">
                  <div className="mb-1 font-medium">{formatSectionLabel(toolEvent.toolName)}</div>
                  <div className="text-xs text-muted-foreground">{toolEvent.inputSummary}</div>
                  <div className="mt-2 text-sm">{toolEvent.outputSummary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
