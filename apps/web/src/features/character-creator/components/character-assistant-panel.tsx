import type { JSONContent } from '@tiptap/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuRefreshCw, LuSparkles, LuX } from 'react-icons/lu';

import { toastError } from '@~/components/toastifications/create-jsx-toasts';
import { Button } from '@~/components/ui/button/button';
import { Dialog, DialogContent, DialogTitle } from '@~/components/ui/dialog';

import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import {
  deriveNextPromptSuggestions,
  mergeNextPromptSuggestions,
  readModelPromptSuggestions,
} from '../lib/assistant/next-prompt-suggestions';
import { CHARACTER_ASSISTANT_FOCUS_KINDS } from '../lib/character-assistant-contracts';
import type { CharacterEditFieldKey } from '../lib/character-edit-proposal';
import { CharacterAssistantConversation } from './character-assistant-conversation';
import { ChatInputEditor } from './editor/chat-input-editor';
import { ResizablePanelHandle } from './resizable-panel-handle';
import { WORKSPACE_PANEL_WIDTHS } from './workspace-panel-layout';

function formatFieldLabel(fieldKey: CharacterEditFieldKey) {
  return fieldKey
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The assistant action failed.';
}

export interface iCharacterAssistantPanelProps {
  isOverlay: boolean;
  onOpenConnectionSettings: () => void;
  onRestoreAssistantToggleFocus: () => void;
  onWidthChange: (width: number) => void;
  width: number;
}

export function CharacterAssistantPanel({
  isOverlay,
  onOpenConnectionSettings,
  onRestoreAssistantToggleFocus,
  onWidthChange,
  width,
}: iCharacterAssistantPanelProps) {
  const { isAssistantOpen, assistantFocus, closeAssistant, openAssistantForField, workspace } = useCharacterAssistant();
  const { apiKey, card, data, fieldTemplates, generationSettings } = useCharacterCreatorContext();
  const [inputValue, setInputValue] = useState('');
  const [inputTemplateIds, setInputTemplateIds] = useState<string[]>([]);
  const [inputDocument, setInputDocument] = useState<JSONContent | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const settledOutcomeRef = useRef<HTMLDivElement>(null);
  const hydratedDraftIdRef = useRef<string | null>(null);
  const focusLabel =
    assistantFocus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field
      ? formatFieldLabel(assistantFocus.fieldKey)
      : 'Whole character';
  const assistantTitle =
    assistantFocus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field ? `Discuss ${focusLabel}` : 'Tenzo Assistant';
  const suggestions = useMemo(
    () =>
      mergeNextPromptSuggestions({
        deterministic: deriveNextPromptSuggestions({ card, messages: workspace.messages }),
        modelProvided: readModelPromptSuggestions(workspace.messages),
      }),
    [card, workspace.messages],
  );
  const missingConnectionSettings = [
    generationSettings.endpoint.trim() ? null : 'endpoint',
    generationSettings.model.trim() ? null : 'model',
    apiKey.trim() ? null : 'API key',
  ].filter((setting): setting is string => setting !== null);

  useEffect(() => {
    if (!workspace.composerDraftSessionId || hydratedDraftIdRef.current === workspace.composerDraftSessionId) return;
    hydratedDraftIdRef.current = workspace.composerDraftSessionId;
    setInputValue(workspace.composerDraft.text);
    setInputTemplateIds(workspace.composerDraft.templateIds);
    setInputDocument(workspace.composerDraft.document);
  }, [workspace.composerDraft, workspace.composerDraftSessionId]);
  useEffect(() => {
    if (!workspace.composerDraftSessionId || hydratedDraftIdRef.current !== workspace.composerDraftSessionId)
      return undefined;
    const timeout = window.setTimeout(() => {
      void workspace.updateComposerDraft({
        text: inputValue,
        templateIds: inputTemplateIds,
        scopeLabel: focusLabel,
        document: inputDocument,
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [focusLabel, inputDocument, inputTemplateIds, inputValue, workspace]);
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: workspace.isRunning ? 'auto' : 'smooth', block: 'end' });
  }, [workspace.messages, workspace.activeProposals.length, workspace.isRunning]);

  const send = async (message: string) => {
    if (!message.trim() || workspace.isRunning) return false;
    const templates = fieldTemplates
      .filter((template) => inputTemplateIds.includes(template.id))
      .map(({ id, name, mode, fieldKeys, content }) => ({ id, name, mode, fieldKeys, content }));
    return workspace.sendMessage(message, { templates });
  };
  const handleSubmit = async () => {
    if (await send(inputValue)) {
      setInputValue('');
      setInputTemplateIds([]);
      setInputDocument(null);
    }
  };

  const panelContent = (
    <>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium">{assistantTitle}</p>
          <p className="truncate text-xs text-muted-foreground">
            {data.name.trim() || 'Untitled character'} / {focusLabel}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" aria-label="Close Character Assistant" onClick={closeAssistant}>
          <LuX className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4" aria-label="Assistant conversation">
        <CharacterAssistantConversation
          messages={workspace.messages}
          proposals={workspace.activeProposals}
          isRunning={workspace.isRunning}
          activityLabel={workspace.activityLabel}
          errorMessage={workspace.errorMessage}
          settledOutcomeRef={settledOutcomeRef}
          onApply={(proposalId, fieldKeys) => {
            void workspace
              .applyProposalFields(proposalId, fieldKeys)
              .catch((error: unknown) => toastError('Changes were not applied', getErrorMessage(error)));
          }}
          onReject={(proposalId, fieldKeys) => {
            void workspace
              .rejectProposalFields(proposalId, fieldKeys)
              .catch((error: unknown) => toastError('Proposal was not updated', getErrorMessage(error)));
          }}
          onApplyAll={() => {
            void workspace
              .applyAllProposals()
              .catch((error: unknown) => toastError('Changes were not applied', getErrorMessage(error)));
          }}
          onRejectAll={() => {
            void workspace
              .discardAllProposals()
              .catch((error: unknown) => toastError('Proposals were not discarded', getErrorMessage(error)));
          }}
          onJumpToField={openAssistantForField}
          onSendMessage={(message) => {
            void send(message);
          }}
        />
        <div ref={conversationEndRef} aria-hidden="true" />
      </div>
      <footer className="grid gap-2 border-t bg-background p-3">
        {!workspace.isConnectionConfigured ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
          >
            <div>
              <p className="text-sm font-medium">Connect the Assistant</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Set {missingConnectionSettings.join(', ')} before sending a message.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={onOpenConnectionSettings}>
              Open Settings
            </Button>
          </div>
        ) : (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Suggested next prompts">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 rounded-full"
                  disabled={workspace.isRunning}
                  onClick={() => {
                    if (suggestion.id === 'premise') setInputValue(suggestion.prompt);
                    else void send(suggestion.prompt);
                  }}
                >
                  {suggestion.label}
                </Button>
              ))}
            </div>
            <ChatInputEditor
              value={inputValue}
              content={inputDocument}
              templates={fieldTemplates}
              isDisabled={workspace.isRunning}
              ariaLabel={`Message Character Assistant about ${focusLabel.toLocaleLowerCase()}`}
              placeholder={`Ask about ${focusLabel.toLocaleLowerCase()}...`}
              onValueChange={(value, templateIds, content) => {
                setInputValue(value);
                setInputTemplateIds(templateIds);
                setInputDocument(content);
              }}
              onSubmit={() => {
                void handleSubmit();
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={workspace.messages.length === 0}
                onClick={() => {
                  void workspace.clearConversation();
                  setInputValue('');
                  setInputDocument(null);
                }}
              >
                New conversation
              </Button>
              {workspace.isRunning ? (
                <Button type="button" size="sm" variant="outline" onClick={workspace.cancelRun}>
                  Stop
                </Button>
              ) : (
                <div className="flex gap-2">
                  {workspace.messages.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void workspace.requestResponse();
                      }}
                    >
                      {workspace.errorMessage ? <LuRefreshCw className="size-4" /> : <LuSparkles className="size-4" />}
                      {workspace.errorMessage ? 'Retry' : 'Regenerate'}
                    </Button>
                  ) : null}
                  <Button type="submit" size="sm" disabled={!inputValue.trim()}>
                    Send
                  </Button>
                </div>
              )}
            </div>
          </form>
        )}
      </footer>
    </>
  );

  if (isOverlay)
    return (
      <Dialog
        open={isAssistantOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeAssistant();
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="inset-y-0 top-0 right-0 left-auto z-50 h-svh w-[min(28rem,100vw)] max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-none border-y-0 border-r-0 p-0 shadow-2xl"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreAssistantToggleFocus();
          }}
        >
          <DialogTitle className="sr-only">Character Assistant</DialogTitle>
          {panelContent}
        </DialogContent>
      </Dialog>
    );
  return (
    <div className="flex h-full min-h-0 shrink-0">
      <ResizablePanelHandle
        ariaLabel="Resize assistant panel"
        direction={-1}
        minWidth={WORKSPACE_PANEL_WIDTHS.assistant.min}
        maxWidth={WORKSPACE_PANEL_WIDTHS.assistant.max}
        width={width}
        onWidthChange={onWidthChange}
      />
      <aside
        aria-label="Character Assistant"
        className="grid h-full min-h-0 shrink-0 grid-rows-[auto_minmax(0,1fr)_auto] border-l bg-background"
        style={{ width }}
      >
        {panelContent}
      </aside>
    </div>
  );
}
