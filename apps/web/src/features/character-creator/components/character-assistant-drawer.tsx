import { useState } from 'react';
import { LuLoaderCircle, LuSparkles, LuTriangleAlert } from 'react-icons/lu';

import { toastError } from '@~/components/toastifications/create-jsx-toasts';
import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@~/components/ui/dialog';
import { Textarea } from '@~/components/ui/textarea';
import { cn } from '@~/lib/utils';

import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { CHARACTER_ASSISTANT_FOCUS_KINDS } from '../lib/character-assistant-contracts';
import { CHARACTER_EDIT_PATCH_STATUSES } from '../lib/character-edit-proposal';
import type { CharacterEditFieldKey } from '../lib/character-edit-proposal';
import { MangaSynthesisAttachment } from './manga-synthesis-attachment';

function formatFieldLabel(fieldKey: CharacterEditFieldKey) {
  return fieldKey
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The assistant action failed.';
}

export function CharacterAssistantDrawer() {
  const { isAssistantOpen, assistantFocus, closeAssistant, workspace } = useCharacterAssistant();
  const [inputValue, setInputValue] = useState('');
  const focusLabel =
    assistantFocus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field
      ? formatFieldLabel(assistantFocus.fieldKey)
      : 'Whole character';

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

  return (
    <Dialog open={isAssistantOpen} onOpenChange={(isOpen) => (isOpen ? undefined : closeAssistant())}>
      <DialogContent className="top-0 right-0 bottom-0 left-auto h-svh w-full max-w-full translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-none border-y-0 border-r-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b p-5 pr-12 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              <LuSparkles className="size-5 text-primary" />
              Character Assistant
            </DialogTitle>
            <Badge variant="outline">{focusLabel}</Badge>
            {workspace.activePatches.length > 0 ? <Badge>{workspace.activePatches.length} proposed</Badge> : null}
          </div>
          <DialogDescription>Ask for a focused rewrite or a coordinated character-level change.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto">
          <div className="grid gap-5 p-5">
            {workspace.messages.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Describe the outcome you want. The assistant will place every proposed edit on the affected character
                field for review.
              </div>
            ) : null}

            <div className="grid gap-3">
              {workspace.messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[92%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap',
                    message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'border bg-card',
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
              <section className="grid gap-3" aria-label="Assistant proposals">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Proposed changes</p>
                    <p className="text-xs text-muted-foreground">Review detailed text diffs on their native fields.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void workspace
                          .discardAllProposals()
                          .catch((error: unknown) =>
                            toastError('Proposals were not discarded', getErrorMessage(error)),
                          );
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
                  <div key={proposal.id} className="rounded-xl border bg-card p-3">
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
          </div>
        </div>

        <div className="grid gap-3 border-t bg-background p-4">
          <MangaSynthesisAttachment />
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();

              if (!inputValue.trim() || workspace.isRunning || !workspace.isConnectionConfigured) {
                return;
              }

              const message = inputValue;
              setInputValue('');
              void workspace
                .sendMessage(message)
                .catch((error: unknown) => toastError('Message was not sent', getErrorMessage(error)));
            }}
          >
            <Textarea
              value={inputValue}
              rows={3}
              disabled={workspace.isRunning || !workspace.isConnectionConfigured}
              placeholder={`Ask about ${focusLabel.toLocaleLowerCase()}...`}
              onChange={(event) => setInputValue(event.target.value)}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
