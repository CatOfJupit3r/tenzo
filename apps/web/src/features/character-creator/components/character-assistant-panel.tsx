import { useEffect, useRef, useState } from 'react';
import { LuLoaderCircle, LuSparkles, LuTriangleAlert, LuX } from 'react-icons/lu';

import { toastError } from '@~/components/toastifications/create-jsx-toasts';
import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { cn } from '@~/lib/utils';

import { GUIDED_STEP_IDS } from '../constants/guided-flow';
import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import {
  CHARACTER_ASSISTANT_FOCUS_KINDS,
  CHARACTER_ASSISTANT_MESSAGE_ROLES,
} from '../lib/character-assistant-contracts';
import { CHARACTER_EDIT_PATCH_STATUSES } from '../lib/character-edit-proposal';
import type { CharacterEditFieldKey } from '../lib/character-edit-proposal';
import { ChatInputEditor } from './editor/chat-input-editor';
import { GuidedDiscoveryStepPanel } from './guided-flow/guided-discovery-step-panel';
import { GuidedImageStep } from './guided-flow/guided-image-step';
import { GuidedStepHeader } from './guided-flow/guided-step-header';
import { GuidedStepPanel } from './guided-flow/guided-step-panel';

function formatFieldLabel(fieldKey: CharacterEditFieldKey) {
  return fieldKey
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The assistant action failed.';
}

export function CharacterAssistantPanel() {
  const { isAssistantOpen, assistantFocus, closeAssistant, workspace, guidedFlow } = useCharacterAssistant();
  const { fieldTemplates } = useCharacterCreatorContext();
  const [inputValue, setInputValue] = useState('');
  const [inputTemplateIds, setInputTemplateIds] = useState<string[]>([]);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const shouldFollowConversationRef = useRef(true);
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
  const lastMessageContent = workspace.messages.at(-1)?.content;

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
          onUsePrompt={setInputValue}
        />
      );
    }
  }

  if (!isAssistantOpen) {
    return null;
  }

  return (
    <aside
      aria-label="Character Assistant"
      className="fixed inset-y-0 right-0 z-50 flex h-svh w-[min(30rem,100vw)] shrink-0 flex-col border-l bg-background shadow-2xl xl:sticky xl:top-0 xl:z-30 xl:w-120 xl:shadow-none"
    >
      <header className="grid gap-3 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <LuSparkles className="size-5 text-primary" />
                Character Assistant
              </h2>
              <Badge variant="outline">{focusLabel}</Badge>
              {workspace.activePatches.length > 0 ? <Badge>{workspace.activePatches.length} proposed</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Chat continuously while you inspect and edit the card beside it.
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Hide assistant" onClick={closeAssistant}>
            <LuX className="size-4" />
          </Button>
        </div>

        {scaffoldState ? (
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

      {isGuided ? (
        <div className="max-h-[42svh] overflow-y-auto border-b bg-muted/10 p-3">
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
                <Button type="button" size="sm" variant="outline" onClick={guidedFlow.applyConceptToCard}>
                  Use idea
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isGuided && guidedFlow.isGuidedComplete ? (
        <div className="flex items-center justify-between gap-3 border-b bg-primary/5 px-4 py-2 text-sm">
          <span>Guided setup is complete. Keep chatting or reopen any scaffold above.</span>
          <Button type="button" size="sm" variant="ghost" onClick={guidedFlow.restartGuidedSession}>
            Start over
          </Button>
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
        aria-label="Assistant conversation"
        onScroll={(event) => {
          const target = event.currentTarget;
          shouldFollowConversationRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 80;
        }}
      >
        <div className="grid gap-4">
          {workspace.messages.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              Describe the character or ask for a focused change. Suggestions appear on their native fields for review.
            </div>
          ) : null}

          <div className="grid gap-3">
            {workspace.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[92%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap',
                  message.role === CHARACTER_ASSISTANT_MESSAGE_ROLES.user
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'border bg-card',
                )}
              >
                {message.content}
              </div>
            ))}
          </div>

          <div aria-live="polite" aria-busy={workspace.isRunning}>
            {workspace.activityLabel ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LuLoaderCircle className="size-4 animate-spin" />
                {workspace.activityLabel}
              </div>
            ) : null}
          </div>

          {workspace.errorMessage ? (
            <div role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
              <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{workspace.errorMessage}</p>
            </div>
          ) : null}

          {workspace.activeProposals.length > 0 ? (
            <section className="grid gap-3 rounded-xl border bg-muted/15 p-3" aria-label="Assistant proposals">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Proposed changes</p>
                  <p className="text-xs text-muted-foreground">
                    Detailed diffs also appear beside the affected fields.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void workspace
                        .discardAllProposals()
                        .catch((error: unknown) => toastError('Proposals were not discarded', getErrorMessage(error)));
                    }}
                  >
                    Reject all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void handleApplyAll();
                    }}
                  >
                    Apply all
                  </Button>
                </div>
              </div>

              {workspace.activeProposals.map((proposal) => (
                <div key={proposal.id} className="rounded-lg border bg-background p-3">
                  {proposal.summary ? <p className="mb-3 text-sm">{proposal.summary}</p> : null}
                  <div className="grid gap-2">
                    {proposal.patches
                      .filter((patch) => patch.status !== CHARACTER_EDIT_PATCH_STATUSES.rejected)
                      .map((patch) => (
                        <div
                          key={patch.fieldKey}
                          className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{formatFieldLabel(patch.fieldKey)}</p>
                            <p className="text-xs text-muted-foreground">{patch.status}</p>
                          </div>
                          {patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed ? (
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  void handleReject(proposal.id, [patch.fieldKey]);
                                }}
                              >
                                Reject
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  void handleApply(proposal.id, [patch.fieldKey]);
                                }}
                              >
                                Apply
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          <div ref={conversationEndRef} aria-hidden="true" />
        </div>
      </div>

      <footer className="grid gap-2 border-t bg-background p-3">
        {guidedFlow.isGuidedDiscoveryMode ? (
          <p className="text-xs text-muted-foreground">
            You can chat now, or select discovery directions above and continue when ready.
          </p>
        ) : null}
        <form
          className="grid gap-2"
          data-character-assistant-form="true"
          onSubmit={(event) => {
            event.preventDefault();

            if (!inputValue.trim() || workspace.isRunning || !workspace.isConnectionConfigured) {
              return;
            }

            const message = inputValue;
            const templates = fieldTemplates
              .filter((template) => inputTemplateIds.includes(template.id))
              .map(({ id, name, mode, fieldKeys, content }) => ({ id, name, mode, fieldKeys, content }));
            shouldFollowConversationRef.current = true;
            setInputValue('');
            setInputTemplateIds([]);
            void workspace
              .sendMessage(message, { templates })
              .catch((error: unknown) => toastError('Message was not sent', getErrorMessage(error)));
          }}
        >
          <ChatInputEditor
            value={inputValue}
            templates={fieldTemplates}
            preferredFieldKeys={guidedFlow.currentStepDefinition?.suggestedTemplateFieldKeys}
            isDisabled={workspace.isRunning || !workspace.isConnectionConfigured}
            placeholder={
              isGuided && guidedFlow.currentStepDefinition
                ? `Discuss ${guidedFlow.currentStepDefinition.title.toLocaleLowerCase()}...`
                : `Ask about ${focusLabel.toLocaleLowerCase()}...`
            }
            onValueChange={(value, templateIds) => {
              setInputValue(value);
              setInputTemplateIds(templateIds);
            }}
            onSubmit={() => {
              if (inputValue.trim() && !workspace.isRunning && workspace.isConnectionConfigured) {
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
              }}
            >
              New conversation
            </Button>
            {workspace.isRunning ? (
              <Button type="button" size="sm" variant="outline" onClick={workspace.cancelRun}>
                Stop
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={!inputValue.trim() || !workspace.isConnectionConfigured}>
                Send
              </Button>
            )}
          </div>
        </form>
      </footer>
    </aside>
  );
}
