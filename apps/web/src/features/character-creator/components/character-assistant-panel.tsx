import type { JSONContent } from '@tiptap/core';
import { useEffect, useRef, useState } from 'react';
import { LuHistory, LuRefreshCw, LuSparkles, LuX } from 'react-icons/lu';

import { toastError, toastSuccess } from '@~/components/toastifications/create-jsx-toasts';
import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button/button';
import { Dialog, DialogContent, DialogTitle } from '@~/components/ui/dialog';
import { cn } from '@~/lib/utils';

import { GUIDED_STEP_IDS } from '../constants/guided-flow';
import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { CHARACTER_ASSISTANT_FOCUS_KINDS } from '../lib/character-assistant-contracts';
import type { CharacterEditFieldKey } from '../lib/character-edit-proposal';
import { CharacterAssistantConversation } from './character-assistant-conversation';
import { ChatInputEditor } from './editor/chat-input-editor';
import { GuidedDiscoveryStepPanel } from './guided-flow/guided-discovery-step-panel';
import { GuidedImageStep } from './guided-flow/guided-image-step';
import { GuidedStepHeader } from './guided-flow/guided-step-header';
import { GuidedStepPanel } from './guided-flow/guided-step-panel';
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
  const { isAssistantOpen, assistantFocus, closeAssistant, openAssistant, workspace, guidedFlow } =
    useCharacterAssistant();
  const { apiKey, data, fieldTemplates, generationSettings } = useCharacterCreatorContext();
  const [inputValue, setInputValue] = useState('');
  const [inputTemplateIds, setInputTemplateIds] = useState<string[]>([]);
  const [inputDocument, setInputDocument] = useState<JSONContent | null>(null);
  const [inputScopeLabel, setInputScopeLabel] = useState('Whole character');
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const settledOutcomeRef = useRef<HTMLDivElement>(null);
  const shouldFollowConversationRef = useRef(true);
  const shouldRestoreAssistantToggleFocusRef = useRef(true);
  const hydratedComposerSessionIdRef = useRef<string | null>(null);
  const wasRunningRef = useRef(workspace.isRunning);
  const { updateComposerDraft } = workspace;
  const { guidedState } = guidedFlow;
  const scaffoldState = guidedFlow.savedGuidedState;
  const discoveryState = guidedState?.discovery;
  const isGuided = Boolean(guidedState && guidedFlow.currentStepDefinition);
  const isDiscoveryConcept = Boolean(
    guidedState && guidedFlow.currentStepDefinition?.id === GUIDED_STEP_IDS.concept && discoveryState?.originalPremise,
  );
  const focusLabel =
    assistantFocus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field
      ? formatFieldLabel(assistantFocus.fieldKey)
      : 'Whole character';
  const isFieldFocus = assistantFocus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field;
  const assistantTitle =
    assistantFocus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field ? `Discuss ${focusLabel}` : 'Tenzo Assistant';
  const assistantContextLabel =
    assistantFocus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field
      ? `${data.name.trim() || 'Untitled character'} / ${focusLabel}`
      : 'Whole-character conversation';
  const missingConnectionSettings = [
    generationSettings.endpoint.trim() ? null : 'endpoint',
    generationSettings.model.trim() ? null : 'model',
    apiKey.trim() ? null : 'API key',
  ].filter((setting): setting is string => setting !== null);
  const composerLabel = isGuided
    ? `Message Character Assistant about ${guidedFlow.currentStepDefinition?.title.toLocaleLowerCase() ?? focusLabel.toLocaleLowerCase()}`
    : `Message Character Assistant about ${focusLabel.toLocaleLowerCase()}`;
  const isGuidedScopeMismatch = isGuided && assistantFocus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field;
  const isDraftScopeMismatch = !isGuided && Boolean(inputValue.trim()) && inputScopeLabel !== focusLabel;
  const isScopeMismatch = isGuidedScopeMismatch || isDraftScopeMismatch;
  const isComposerDisabled = workspace.isRunning || !workspace.isConnectionConfigured || isScopeMismatch;
  const conflictingScopeLabel = isGuidedScopeMismatch
    ? `${guidedFlow.currentStepDefinition?.title ?? 'Guided'} scaffold`
    : inputScopeLabel;
  const keepScopeDraftLabel = isGuidedScopeMismatch ? `Keep ${conflictingScopeLabel}` : `Use draft for ${focusLabel}`;
  let assistantBodyGridClassName = 'grid-rows-[minmax(0,1fr)]';

  if (isGuided && !isFieldFocus) {
    assistantBodyGridClassName = 'grid-rows-[minmax(0,1fr)_minmax(12rem,1fr)]';
  } else if (guidedFlow.isGuidedComplete) {
    assistantBodyGridClassName = 'grid-rows-[auto_minmax(0,1fr)]';
  }

  let composerPlaceholder = `Ask about ${focusLabel.toLocaleLowerCase()}...`;

  if (!workspace.isConnectionConfigured) {
    composerPlaceholder = 'Configure the Assistant connection to start chatting.';
  } else if (isScopeMismatch) {
    composerPlaceholder = 'Choose how to handle the existing context first.';
  } else if (isGuided && guidedFlow.currentStepDefinition) {
    composerPlaceholder = `Discuss ${guidedFlow.currentStepDefinition.title.toLocaleLowerCase()}...`;
  } else if (isFieldFocus) {
    composerPlaceholder = `What should change in ${focusLabel.toLocaleLowerCase()}?`;
  }

  const lastMessageContent = workspace.messages.at(-1)?.content;

  useEffect(() => {
    if (isAssistantOpen) {
      shouldRestoreAssistantToggleFocusRef.current = true;
    }
  }, [isAssistantOpen]);

  useEffect(() => {
    if (
      !workspace.composerDraftSessionId ||
      hydratedComposerSessionIdRef.current === workspace.composerDraftSessionId
    ) {
      return;
    }

    hydratedComposerSessionIdRef.current = workspace.composerDraftSessionId;
    setInputValue(workspace.composerDraft.text);
    setInputTemplateIds(workspace.composerDraft.templateIds);
    setInputDocument(workspace.composerDraft.document);
    setInputScopeLabel(workspace.composerDraft.scopeLabel);
  }, [workspace.composerDraft, workspace.composerDraftSessionId]);

  useEffect(() => {
    if (
      !workspace.composerDraftSessionId ||
      hydratedComposerSessionIdRef.current !== workspace.composerDraftSessionId
    ) {
      return () => undefined;
    }

    const timeout = window.setTimeout(() => {
      void updateComposerDraft({
        text: inputValue,
        templateIds: inputTemplateIds,
        scopeLabel: inputScopeLabel,
        document: inputDocument,
      }).catch((error: unknown) => toastError('Draft was not saved', getErrorMessage(error)));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    inputDocument,
    inputScopeLabel,
    inputTemplateIds,
    inputValue,
    updateComposerDraft,
    workspace.composerDraftSessionId,
  ]);

  useEffect(() => {
    setIsHistoryVisible(false);
  }, [assistantContextLabel]);

  useEffect(() => {
    if (workspace.activeProposals.length > 0) {
      setIsHistoryVisible(true);
    }
  }, [workspace.activeProposals.length]);

  useEffect(() => {
    if (!isAssistantOpen || !shouldFollowConversationRef.current) {
      return;
    }

    conversationEndRef.current?.scrollIntoView({
      behavior: workspace.isRunning ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [
    isAssistantOpen,
    lastMessageContent,
    workspace.activeProposals.length,
    workspace.activityLabel,
    workspace.isRunning,
  ]);

  useEffect(() => {
    if (wasRunningRef.current && !workspace.isRunning) {
      shouldFollowConversationRef.current = true;
      settledOutcomeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    wasRunningRef.current = workspace.isRunning;
  }, [workspace.isRunning]);

  const handleApply = async (proposalId: string, fieldKeys?: CharacterEditFieldKey[]) => {
    try {
      await workspace.applyProposalFields(proposalId, fieldKeys);
    } catch (error) {
      toastError('Changes were not applied', getErrorMessage(error));
    }
  };

  const handleReject = async (proposalId: string, fieldKeys: CharacterEditFieldKey[]) => {
    try {
      await workspace.rejectProposalFields(proposalId, fieldKeys);
    } catch (error) {
      toastError('Proposal was not updated', getErrorMessage(error));
    }
  };

  const handleApplyAll = async () => {
    try {
      await workspace.applyAllProposals();
    } catch (error) {
      toastError('Changes were not applied', getErrorMessage(error));
    }
  };

  const exitGuidedModeForScopeChange = async () => {
    if (!isGuided) {
      return;
    }

    await guidedFlow.exitGuidedMode();
  };

  const handleKeepScopeDraft = () => {
    if (isGuidedScopeMismatch) {
      openAssistant();
      return;
    }

    setInputScopeLabel(focusLabel);
  };

  const handleReplaceScopeDraft = async () => {
    try {
      await exitGuidedModeForScopeChange();
      setInputValue(`Help me refine the ${focusLabel.toLocaleLowerCase()} field.`);
      setInputTemplateIds([]);
      setInputDocument(null);
      setInputScopeLabel(focusLabel);
    } catch (error) {
      toastError('Assistant scope was not changed', getErrorMessage(error));
    }
  };

  const handleClearScopeDraft = async () => {
    try {
      await exitGuidedModeForScopeChange();
      setInputValue('');
      setInputTemplateIds([]);
      setInputDocument(null);
      setInputScopeLabel(focusLabel);
    } catch (error) {
      toastError('Assistant scope was not changed', getErrorMessage(error));
    }
  };

  const handleSubmitMessage = async () => {
    if (!inputValue.trim() || workspace.isRunning || isScopeMismatch) {
      return;
    }

    const message = inputValue;
    const templates = fieldTemplates
      .filter((template) => inputTemplateIds.includes(template.id))
      .map(({ id, name, mode, fieldKeys, content }) => ({ id, name, mode, fieldKeys, content }));
    shouldFollowConversationRef.current = true;
    setIsHistoryVisible(true);

    const wasSuccessful = await workspace.sendMessage(message, { templates });
    if (wasSuccessful) {
      setInputValue('');
      setInputTemplateIds([]);
      setInputDocument(null);
      setInputScopeLabel(focusLabel);
    }
  };

  const handleRequestResponse = async () => {
    const templates = fieldTemplates
      .filter((template) => inputTemplateIds.includes(template.id))
      .map(({ id, name, mode, fieldKeys, content }) => ({ id, name, mode, fieldKeys, content }));
    shouldFollowConversationRef.current = true;
    setIsHistoryVisible(true);
    await workspace.requestResponse({ templates });
  };

  let guidedStepPanel = null;

  if (isGuided && guidedFlow.currentStepDefinition && discoveryState) {
    if (isDiscoveryConcept) {
      guidedStepPanel = (
        <GuidedDiscoveryStepPanel
          definition={guidedFlow.currentStepDefinition}
          canContinue={guidedFlow.canContinue}
          isRunning={workspace.isRunning}
          hasUnappliedProposals={workspace.activeProposals.length > 0}
          discoveryState={discoveryState}
          generationState={guidedFlow.discoveryCategoryGenerationState}
          onContinue={guidedFlow.continueToNextStep}
          onExit={guidedFlow.exitGuidedMode}
          onRegenerateCategory={guidedFlow.regenerateDiscoveryCategory}
          onCancelGeneration={guidedFlow.cancelDiscoveryGeneration}
          onToggleSelection={guidedFlow.toggleDiscoverySelection}
          onCreateCustomDirection={guidedFlow.createDiscoveryCustomVariant}
        />
      );
    } else {
      guidedStepPanel = (
        <GuidedStepPanel
          definition={guidedFlow.currentStepDefinition}
          canContinue={guidedFlow.canContinue}
          isRunning={workspace.isRunning}
          hasUnappliedProposals={workspace.activeProposals.length > 0}
          onContinue={guidedFlow.continueToNextStep}
          onSkip={guidedFlow.skipStep}
          onExit={guidedFlow.exitGuidedMode}
          onApplyAllProposals={workspace.applyAllProposals}
          onRejectAllProposals={workspace.discardAllProposals}
          onUsePrompt={(prompt) => {
            setInputValue(prompt);
            setInputTemplateIds([]);
            setInputDocument(null);
            setInputScopeLabel(`${guidedFlow.currentStepDefinition?.title ?? 'Guided'} scaffold`);
          }}
        />
      );
    }
  }

  if (!isAssistantOpen) {
    return null;
  }

  const panelContent = (
    <>
      <header className="grid gap-3 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <LuSparkles className="size-5 text-primary" />
                {assistantTitle}
              </h2>
              {workspace.activePatches.length > 0 ? <Badge>{workspace.activePatches.length} proposed</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{assistantContextLabel}</p>
          </div>
          <div className="flex items-center gap-1">
            {isFieldFocus && workspace.messages.length > 0 ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={isHistoryVisible ? 'Hide assistant history' : 'Show assistant history'}
                aria-expanded={isHistoryVisible}
                tooltip={isHistoryVisible ? 'Hide history' : 'Show history'}
                onClick={() => setIsHistoryVisible(!isHistoryVisible)}
              >
                <LuHistory className="size-4" />
              </Button>
            ) : null}
            <Button type="button" size="icon" variant="ghost" aria-label="Hide assistant" onClick={closeAssistant}>
              <LuX className="size-4" />
            </Button>
          </div>
        </div>

        {scaffoldState && !isFieldFocus ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Prompt scaffolds</p>
              {!isGuided ? <span className="text-xs text-muted-foreground">Choose any step to resume</span> : null}
            </div>
            <GuidedStepHeader
              currentStep={scaffoldState.currentStep}
              completedSteps={scaffoldState.completedSteps}
              isDisabled={workspace.isRunning}
              onStepSelect={(stepId) => {
                void guidedFlow.navigateToStep(stepId);
              }}
            />
          </div>
        ) : null}
      </header>

      <div className={cn('grid min-h-0', assistantBodyGridClassName)}>
        {isGuided && !isFieldFocus ? (
          <div className="min-h-0 overflow-y-auto border-b bg-muted/10 p-3">
            <div className="grid gap-3">
              {guidedStepPanel}
              {guidedFlow.currentStepDefinition?.isImageStepAllowed ? (
                <GuidedImageStep
                  analysis={guidedFlow.latestAnalysis}
                  errorMessage={guidedFlow.imageAnalysisError}
                  isAnalyzing={guidedFlow.isAnalyzingImage}
                  onAnalyze={async (file, hint) => {
                    await guidedFlow.analyzeImage(file, hint).catch(() => undefined);
                  }}
                  onRemove={async () => {
                    const attachmentId = guidedState?.attachments.at(-1)?.id;
                    if (attachmentId) {
                      await guidedFlow.removeImageAttachment(attachmentId);
                    }
                  }}
                />
              ) : null}
              {guidedState?.concept ? (
                <div className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">Concept recorded</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{guidedState.concept.premise}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      guidedFlow.applyConceptToCard();
                      toastSuccess('Idea added', 'The general character idea now uses this guided concept.');
                    }}
                  >
                    Use idea
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isGuided && guidedFlow.isGuidedComplete && !isFieldFocus ? (
          <div className="flex items-center justify-between gap-3 border-b bg-primary/5 px-4 py-2 text-sm">
            <span>Guided setup is complete. Keep chatting or reopen any scaffold above.</span>
            <Button type="button" size="sm" variant="ghost" onClick={guidedFlow.restartGuidedSession}>
              Start over
            </Button>
          </div>
        ) : null}

        {isFieldFocus && !isHistoryVisible ? (
          <div className="flex min-h-0 items-center justify-center p-6 text-center">
            <div className="max-w-72 rounded-xl border bg-muted/15 p-4">
              <p className="text-sm font-medium">Revise {focusLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe the outcome you want. Tenzo will propose an edit you can review before applying.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="min-h-0 overflow-y-auto overscroll-contain p-4"
            aria-label="Assistant conversation"
            onScroll={(event) => {
              const target = event.currentTarget;
              shouldFollowConversationRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 80;
            }}
          >
            <div className="grid gap-4">
              <CharacterAssistantConversation
                messages={workspace.messages}
                proposals={workspace.activeProposals}
                currentGuidedStepId={guidedFlow.currentStepDefinition?.id}
                isGuided={isGuided}
                isRunning={workspace.isRunning}
                activityLabel={workspace.activityLabel}
                errorMessage={workspace.errorMessage}
                settledOutcomeRef={settledOutcomeRef}
                onApply={(proposalId, fieldKeys) => {
                  void handleApply(proposalId, fieldKeys);
                }}
                onReject={(proposalId, fieldKeys) => {
                  void handleReject(proposalId, fieldKeys);
                }}
                onApplyAll={() => {
                  void handleApplyAll();
                }}
                onRejectAll={() => {
                  void workspace
                    .discardAllProposals()
                    .catch((error: unknown) => toastError('Proposals were not discarded', getErrorMessage(error)));
                }}
              />
              <div ref={conversationEndRef} aria-hidden="true" />
            </div>
          </div>
        )}
      </div>

      <footer className="grid gap-2 border-t bg-background p-3">
        {guidedFlow.isGuidedDiscoveryMode ? (
          <p className="text-xs text-muted-foreground">
            You can chat now, or select discovery directions above and continue when ready.
          </p>
        ) : null}
        {workspace.isConnectionConfigured && isScopeMismatch ? (
          <div role="alert" className="grid gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <div>
              <p className="text-sm font-medium">Choose which context to use</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {conflictingScopeLabel} is still active, but Ask AI is focused on {focusLabel}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleKeepScopeDraft}>
                {keepScopeDraftLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void handleReplaceScopeDraft();
                }}
              >
                Replace for {focusLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  void handleClearScopeDraft();
                }}
              >
                Clear draft
              </Button>
            </div>
          </div>
        ) : null}
        {!workspace.isConnectionConfigured ? (
          <div
            id="character-assistant-connection-required"
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">Connect the Assistant</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Set {missingConnectionSettings.join(', ')} in Connection settings before sending a message.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                if (isOverlay) {
                  shouldRestoreAssistantToggleFocusRef.current = false;
                  closeAssistant();
                }
                onOpenConnectionSettings();
              }}
            >
              Open Settings
            </Button>
          </div>
        ) : null}
        {workspace.isConnectionConfigured ? (
          <form
            className="grid gap-2"
            data-character-assistant-form="true"
            aria-label={composerLabel}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmitMessage();
            }}
          >
            <ChatInputEditor
              value={inputValue}
              content={inputDocument}
              templates={fieldTemplates}
              preferredFieldKeys={guidedFlow.currentStepDefinition?.suggestedTemplateFieldKeys}
              isDisabled={isComposerDisabled}
              ariaLabel={composerLabel}
              placeholder={composerPlaceholder}
              onValueChange={(value, templateIds, content) => {
                if (!inputValue.trim() && value.trim()) {
                  setInputScopeLabel(
                    isGuided ? `${guidedFlow.currentStepDefinition?.title ?? 'Guided'} scaffold` : focusLabel,
                  );
                } else if (!value.trim()) {
                  setInputScopeLabel(focusLabel);
                }
                setInputValue(value);
                setInputTemplateIds(templateIds);
                setInputDocument(content);
              }}
              onSubmit={() => {
                if (inputValue.trim() && !workspace.isRunning && !isScopeMismatch) {
                  const form = document.querySelector<HTMLFormElement>('[data-character-assistant-form="true"]');
                  form?.requestSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={workspace.messages.length === 0}
                onClick={() => {
                  void workspace
                    .clearConversation()
                    .catch((error: unknown) => toastError('Conversation was not cleared', getErrorMessage(error)));
                  setInputValue('');
                  setInputTemplateIds([]);
                  setInputDocument(null);
                  setInputScopeLabel(focusLabel);
                }}
              >
                New conversation
              </Button>
              {workspace.isRunning ? (
                <Button type="button" size="sm" variant="outline" onClick={workspace.cancelRun}>
                  Stop
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {workspace.messages.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isScopeMismatch}
                      onClick={() => {
                        void handleRequestResponse();
                      }}
                    >
                      {workspace.errorMessage ? <LuRefreshCw className="size-4" /> : <LuSparkles className="size-4" />}
                      {workspace.errorMessage ? 'Retry' : 'Generate response'}
                    </Button>
                  ) : null}
                  <Button type="submit" size="sm" disabled={!inputValue.trim() || isScopeMismatch}>
                    Send
                  </Button>
                </div>
              )}
            </div>
          </form>
        ) : null}
      </footer>
    </>
  );

  if (isOverlay) {
    return (
      <Dialog
        open={isAssistantOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeAssistant();
          }
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="inset-y-0 top-0 right-0 left-auto z-50 h-svh w-[min(28rem,100vw)] max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-none border-y-0 border-r-0 p-0 shadow-2xl"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (shouldRestoreAssistantToggleFocusRef.current) {
              onRestoreAssistantToggleFocus();
            }
          }}
        >
          <DialogTitle className="sr-only">Character Assistant</DialogTitle>
          {panelContent}
        </DialogContent>
      </Dialog>
    );
  }

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
