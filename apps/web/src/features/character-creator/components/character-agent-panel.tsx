import { useMemo, useState } from 'react';
import { LuLoaderCircle, LuRotateCcw, LuTriangleAlert, LuX } from 'react-icons/lu';

import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button/button';
import { Card, CardContent, CardHeader, CardTitle } from '@~/components/ui/card';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@~/components/ui/message-scroller';
import { Textarea } from '@~/components/ui/textarea';
import { cn } from '@~/lib/utils';

import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { useCharacterAgentWorkspace } from '../hooks/use-character-agent-workspace';
import type { CharacterCardChangedFieldKey } from '../lib/character-card-diff';
import { PROVIDER_KINDS } from '../lib/provider-health';
import { CharacterAgentDraftDiff } from './character-agent-draft-diff';

function formatSectionLabel(section: string) {
  return section.replaceAll('_', ' ');
}

function ToolActivityRow({
  toolEvent,
}: {
  toolEvent: { toolName: string; status: string; inputSummary: string; outputSummary: string };
}) {
  const isPending = toolEvent.status === 'pending';
  const isError = toolEvent.status === 'error';

  return (
    <div
      className={cn('rounded-xl border p-3 text-sm', isError ? 'border-destructive/50 bg-destructive/5' : 'bg-card')}
    >
      <div className="mb-1 flex items-center gap-2 font-medium">
        {isPending ? <LuLoaderCircle className="size-3.5 animate-spin text-muted-foreground" /> : null}
        {isError ? <LuTriangleAlert className="size-3.5 text-destructive" /> : null}
        {formatSectionLabel(toolEvent.toolName)}
      </div>
      {isPending ? (
        <div className="text-xs text-muted-foreground">Running...</div>
      ) : (
        <>
          {toolEvent.inputSummary ? (
            <div className="text-xs text-muted-foreground">{toolEvent.inputSummary}</div>
          ) : null}
          <div className={cn('mt-2 text-sm', isError && 'text-destructive')}>{toolEvent.outputSummary}</div>
        </>
      )}
    </div>
  );
}

export function CharacterAgentPanel() {
  const { activeCharacterId, card, replaceCard, apiKey, generationSettings, generalCharacterIdea, connectionHealth } =
    useCharacterCreatorContext();
  const [inputValue, setInputValue] = useState('');
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<Set<CharacterCardChangedFieldKey> | null>(null);
  const {
    fieldDiffs,
    changedSections,
    hasDraftChanges,
    isConnectionConfigured,
    messages,
    toolEvents,
    isRunning,
    errorMessage,
    clearConversation,
    resetSessionFromCharacter,
    applyDraftFields,
    sendMessage,
    cancelRun,
    retryLastRun,
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

  const effectiveSelectedFieldKeys = useMemo(() => {
    if (selectedFieldKeys) {
      return new Set([...selectedFieldKeys].filter((fieldKey) => changedSections.includes(fieldKey)));
    }
    return new Set(changedSections);
  }, [changedSections, selectedFieldKeys]);

  const pendingToolEvents = useMemo(
    () => toolEvents.filter((toolEvent) => toolEvent.status === 'pending'),
    [toolEvents],
  );
  const isThinking = isRunning && pendingToolEvents.length === 0;

  const toggleFieldSelection = (fieldKey: CharacterCardChangedFieldKey) => {
    const next = new Set(effectiveSelectedFieldKeys);

    if (next.has(fieldKey)) {
      next.delete(fieldKey);
    } else {
      next.add(fieldKey);
    }

    setSelectedFieldKeys(next);
  };

  const selectedCount = effectiveSelectedFieldKeys.size;
  const canApplySelected = selectedCount > 0;

  return (
    <Card className="gap-0 overflow-hidden bg-card/95 py-0 shadow-sm">
      <CardHeader className="border-b py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle>Character Agent</CardTitle>
              <Badge variant={hasDraftChanges ? 'default' : 'secondary'}>
                {hasDraftChanges ? 'Draft Changed' : 'Draft Synced'}
              </Badge>
            </div>
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
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <div className="grid gap-4">
          <div className="grid h-128 grid-rows-[1fr_auto] rounded-2xl border bg-background/60 p-4">
            <MessageScrollerProvider autoScroll defaultScrollPosition="end">
              <MessageScroller className="min-h-0">
                <MessageScrollerViewport>
                  <MessageScrollerContent>
                    {messages.length === 0 ? (
                      <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                        Try prompts like &quot;make the whole character more playful but keep the ceremonial mood&quot;
                        or &quot;rewrite the description, personality, and first message so they feel consistent.&quot;
                      </div>
                    ) : null}

                    {messages.map((message) => (
                      <MessageScrollerItem key={message.id} messageId={message.id}>
                        <div
                          className={cn(
                            'max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                            message.role === 'user'
                              ? 'ml-auto bg-primary text-primary-foreground'
                              : 'border bg-card text-card-foreground',
                          )}
                        >
                          <div className="mb-1 text-[11px] font-semibold tracking-wide uppercase opacity-70">
                            {message.role === 'user' ? 'You' : 'Agent'}
                          </div>
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        </div>
                      </MessageScrollerItem>
                    ))}

                    {isThinking ? (
                      <MessageScrollerItem scrollAnchor>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <LuLoaderCircle className="size-3.5 animate-spin" />
                          Agent is thinking...
                        </div>
                      </MessageScrollerItem>
                    ) : null}

                    {pendingToolEvents.map((toolEvent) => (
                      <MessageScrollerItem key={toolEvent.id} scrollAnchor>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <LuLoaderCircle className="size-3.5 animate-spin" />
                          Calling {formatSectionLabel(toolEvent.toolName)}...
                        </div>
                      </MessageScrollerItem>
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton direction="end" />
              </MessageScroller>
            </MessageScrollerProvider>

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
                rows={3}
                disabled={isRunning || !isConnectionConfigured}
                placeholder="Describe the character-level change you want..."
                onChange={(event) => setInputValue(event.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <Button type="button" size="sm" variant="outline" onClick={cancelRun}>
                      <LuX className="size-3.5" />
                      Cancel
                    </Button>
                  ) : null}
                  <Button type="submit" size="sm" disabled={isRunning || !inputValue.trim() || !isConnectionConfigured}>
                    {isRunning ? 'Running...' : 'Run agent'}
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {errorMessage ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/50 bg-destructive/5 px-3 py-2">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void retryLastRun();
                }}
              >
                <LuRotateCcw className="size-3.5" />
                Retry
              </Button>
            </div>
          ) : null}
          {!isConnectionConfigured ? (
            <p className="text-sm text-muted-foreground">
              Add an endpoint, model, and API key in Connection Settings before starting a character-agent session.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border bg-background/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isDraftInSyncWithCharacter ? 'secondary' : 'default'}>
                  {isDraftInSyncWithCharacter ? 'No pending draft delta' : 'Pending local draft delta'}
                </Badge>
                <Badge variant="outline">{toolEvents.length} tool actions</Badge>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-sm font-medium">Review changes</p>
              <p className="text-xs text-muted-foreground">
                Uncheck any field you don&apos;t want to bring over, then apply the ones you keep.
              </p>
            </div>

            <CharacterAgentDraftDiff
              diffs={fieldDiffs}
              selectedFieldKeys={effectiveSelectedFieldKeys}
              onToggleField={toggleFieldSelection}
            />

            {hasDraftChanges ? (
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canApplySelected}
                  onClick={() => {
                    applyDraftFields([...effectiveSelectedFieldKeys]);
                    setSelectedFieldKeys(null);
                  }}
                >
                  Apply {selectedCount} of {changedSections.length} change{changedSections.length === 1 ? '' : 's'}
                </Button>
              </div>
            ) : null}
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
                <ToolActivityRow key={toolEvent.id} toolEvent={toolEvent} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
