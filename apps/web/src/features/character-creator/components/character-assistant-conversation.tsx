import type { UIMessage } from '@tanstack/ai-react';
import { useMemo, useState } from 'react';
import {
  LuChevronDown,
  LuExternalLink,
  LuFileText,
  LuLoaderCircle,
  LuPencil,
  LuTrash2,
  LuTriangleAlert,
} from 'react-icons/lu';
import { z } from 'zod';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@~/components/ui/alert-dialog';
import { Button } from '@~/components/ui/button/button';
import { Textarea } from '@~/components/ui/textarea';
import { cn } from '@~/lib/utils';

import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from '../lib/assistant/assistant-final-response';
import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA } from '../lib/assistant/character-assistant-contracts';
import { groupCharacterAssistantConversationMessages } from '../lib/assistant/conversation-message-groups';
import { ASSISTANT_TOOL_RENDERER_KINDS, getAssistantToolRendererKind } from '../lib/assistant/tool-part-renderers';
import { readChatAttachmentMetadata } from '../lib/editor/chat-input-attachments';
import { computeRewriteDiffHunks } from '../lib/editor/rewrite-diff';
import {
  CHARACTER_EDIT_PATCH_STATUSES,
  CHARACTER_EDIT_PROPOSAL_SCHEMA,
  isCharacterEditPatchUnresolved,
} from '../lib/proposals/character-edit-proposal';
import type {
  CharacterEditFieldKey,
  iCharacterEditPatch,
  iCharacterEditProposal,
} from '../lib/proposals/character-edit-proposal';
import { CharacterAssistantMessageText } from './assistant/character-assistant-message-text';
import { DiscoveryCardGrid } from './assistant/discovery-card-grid';

function formatFieldLabel(fieldKey: CharacterEditFieldKey) {
  return fieldKey
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readMessagePartMetadata(part: object) {
  return 'metadata' in part ? part.metadata : undefined;
}

function readToolCallError(output: unknown) {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && 'error' in output && typeof output.error === 'string') {
    return output.error;
  }
  return 'The assistant tool could not complete this action.';
}

function readEditableMessageText(message: UIMessage) {
  const text = message.parts
    .flatMap((part) => {
      if (part.type !== 'text' || readChatAttachmentMetadata(readMessagePartMetadata(part))) return [];
      return [part.content];
    })
    .join('\n')
    .trim();
  return text || null;
}

function stringifyPatchValue(patch: iCharacterEditPatch, side: 'old' | 'new') {
  const value = side === 'old' ? patch.oldValue : patch.newValue;
  return typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
}

function CompactPatchDiff({ patch }: { patch: iCharacterEditPatch }) {
  const hunks = useMemo(
    () => computeRewriteDiffHunks(stringifyPatchValue(patch, 'old'), stringifyPatchValue(patch, 'new')),
    [patch],
  );
  return (
    <div className="max-h-40 overflow-auto rounded-md border bg-muted/15 font-mono text-xs">
      {hunks.map((hunk) =>
        hunk.isChanged ? (
          <div key={hunk.id}>
            {hunk.oldText ? <div className="bg-destructive/10 px-2 py-1 text-destructive">- {hunk.oldText}</div> : null}
            {hunk.newText ? <div className="bg-chart-2/10 px-2 py-1 text-foreground">+ {hunk.newText}</div> : null}
          </div>
        ) : null,
      )}
    </div>
  );
}

interface iProposalCardProps {
  proposal: iCharacterEditProposal;
  onApply: (proposalId: string, fieldKeys?: CharacterEditFieldKey[]) => void;
  onReject: (proposalId: string, fieldKeys: CharacterEditFieldKey[]) => void;
  onJumpToField?: (fieldKey: CharacterEditFieldKey) => void;
}

function ProposalCard({ proposal, onApply, onReject, onJumpToField }: iProposalCardProps) {
  const [expandedFields, setExpandedFields] = useState<Set<CharacterEditFieldKey>>(new Set());
  const unresolvedPatches = proposal.patches.filter(isCharacterEditPatchUnresolved);

  if (unresolvedPatches.length === 0) return null;

  return (
    <section className="grid gap-2 rounded-xl border bg-muted/15 p-3" aria-label="Assistant proposal">
      <p className="text-sm font-medium">{proposal.summary ?? 'Proposed changes'}</p>
      {unresolvedPatches.map((patch) => {
        const isExpanded = expandedFields.has(patch.fieldKey);
        return (
          <div key={patch.fieldKey} className="grid gap-2 rounded-lg border bg-background p-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex min-w-0 items-center gap-1 text-left text-sm font-medium"
                aria-expanded={isExpanded}
                onClick={() =>
                  setExpandedFields((current) => {
                    const next = new Set(current);
                    if (next.has(patch.fieldKey)) next.delete(patch.fieldKey);
                    else next.add(patch.fieldKey);
                    return next;
                  })
                }
              >
                <LuChevronDown className={cn('size-4 shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                <span className="truncate">{formatFieldLabel(patch.fieldKey)}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{patch.status}</span>
              </button>
              <div className="flex shrink-0 gap-1">
                {onJumpToField ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Jump to ${formatFieldLabel(patch.fieldKey)}`}
                    onClick={() => onJumpToField(patch.fieldKey)}
                  >
                    <LuExternalLink className="size-3.5" />
                  </Button>
                ) : null}
                {patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onReject(proposal.id, [patch.fieldKey])}
                    >
                      Reject
                    </Button>
                    <Button type="button" size="sm" onClick={() => onApply(proposal.id, [patch.fieldKey])}>
                      Apply
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            {isExpanded ? <CompactPatchDiff patch={patch} /> : null}
          </div>
        );
      })}
    </section>
  );
}

export interface iCharacterAssistantConversationProps {
  messages: readonly UIMessage[];
  proposals: readonly iCharacterEditProposal[];
  isRunning: boolean;
  activityLabel: string | null;
  errorMessage: string | null;
  settledOutcomeRef: React.RefObject<HTMLDivElement | null>;
  onApply: iProposalCardProps['onApply'];
  onReject: iProposalCardProps['onReject'];
  onApplyAll: () => void;
  onRejectAll: () => void;
  onJumpToField?: iProposalCardProps['onJumpToField'];
  onSendMessage?: (message: string) => void;
  onDeleteFromMessage?: (messageId: string) => Promise<unknown>;
  onEditLastUserMessage?: (messageId: string, content: string) => Promise<unknown>;
}

export function CharacterAssistantConversation({
  messages,
  proposals,
  isRunning,
  activityLabel,
  errorMessage,
  settledOutcomeRef,
  onApply,
  onReject,
  onApplyAll,
  onRejectAll,
  onJumpToField,
  onSendMessage,
  onDeleteFromMessage,
  onEditLastUserMessage,
}: iCharacterAssistantConversationProps) {
  const [messagePendingDeletion, setMessagePendingDeletion] = useState<UIMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageWidth, setEditingMessageWidth] = useState<number | null>(null);
  const [editedMessage, setEditedMessage] = useState('');
  const [isUpdatingMessages, setIsUpdatingMessages] = useState(false);
  const proposalsById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const proposedPatchCount = proposals.reduce(
    (count, proposal) =>
      count + proposal.patches.filter((patch) => patch.status === CHARACTER_EDIT_PATCH_STATUSES.proposed).length,
    0,
  );
  const unresolvedPatchCount = proposals.reduce(
    (count, proposal) => count + proposal.patches.filter(isCharacterEditPatchUnresolved).length,
    0,
  );
  const conversationMessages = useMemo(() => groupCharacterAssistantConversationMessages(messages), [messages]);
  const lastUserMessageId = conversationMessages.findLast((message) => message.role === 'user')?.id ?? null;
  const deletionStartIndex = messagePendingDeletion
    ? conversationMessages.findIndex((message) => message.id === messagePendingDeletion.id)
    : -1;
  const deletionCount = deletionStartIndex < 0 ? 0 : conversationMessages.length - deletionStartIndex;
  return (
    <div className="grid gap-4">
      {conversationMessages.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Describe the character, ask for a focused change, or choose a suggestion below.
        </div>
      ) : null}
      {conversationMessages.map((message) => (
        <div
          key={message.id}
          data-conversation-message
          aria-label={message.role === 'user' ? 'User message' : 'Assistant message'}
          className={cn('group grid max-w-[92%] gap-1', message.role === 'user' ? 'ml-auto' : 'mr-auto')}
          style={editingMessageId === message.id && editingMessageWidth ? { width: editingMessageWidth } : undefined}
        >
          <div
            className={cn(
              'grid gap-2 rounded-2xl text-sm leading-relaxed',
              editingMessageId === message.id ? 'p-1.5' : 'px-0.5 py-0.25',
              message.role === 'user'
                ? 'rounded-br-md bg-secondary text-secondary-foreground'
                : 'rounded-bl-md border bg-card',
            )}
          >
            {editingMessageId === message.id ? (
              <form
                className="grid gap-2 text-foreground"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!onEditLastUserMessage || !editedMessage.trim()) return;
                  setIsUpdatingMessages(true);
                  void onEditLastUserMessage(message.id, editedMessage)
                    .then(() => {
                      setEditingMessageId(null);
                      setEditingMessageWidth(null);
                      setEditedMessage('');
                    })
                    .catch(() => undefined)
                    .finally(() => setIsUpdatingMessages(false));
                }}
              >
                <Textarea
                  value={editedMessage}
                  className="min-h-16"
                  aria-label="Edit message"
                  autoFocus
                  disabled={isUpdatingMessages}
                  onChange={(event) => setEditedMessage(event.target.value)}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isUpdatingMessages}
                    onClick={() => {
                      setEditingMessageId(null);
                      setEditingMessageWidth(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isUpdatingMessages || !editedMessage.trim()}>
                    Save and resend
                  </Button>
                </div>
              </form>
            ) : (
              message.parts.map((part, partIndex) => {
                let partKey = `${part.type}-${partIndex}`;
                if (part.type === 'tool-call') partKey = part.id;
                if (part.type === 'text') partKey = `text-${partIndex}`;
                if (part.type === 'text') {
                  const attachment = readChatAttachmentMetadata(readMessagePartMetadata(part));
                  if (attachment)
                    return (
                      <div
                        key={partKey}
                        className="flex items-center gap-2 rounded-md border border-current/20 px-2 py-1.5"
                      >
                        <LuFileText className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                        <span className="shrink-0 text-xs opacity-70">{formatFileSize(attachment.size)}</span>
                      </div>
                    );
                  return <CharacterAssistantMessageText key={partKey} content={part.content} />;
                }
                if (part.type === 'image') {
                  const attachment = readChatAttachmentMetadata(part.metadata);
                  const source =
                    part.source.type === 'data'
                      ? `data:${part.source.mimeType};base64,${part.source.value}`
                      : part.source.value;
                  return (
                    <figure key={partKey} className="grid gap-1">
                      <img
                        src={source}
                        alt={attachment?.name ?? 'Attached image'}
                        className="max-h-64 w-auto max-w-full rounded-md border object-contain"
                      />
                      {attachment ? (
                        <figcaption className="text-xs opacity-70">
                          {attachment.name} · {formatFileSize(attachment.size)}
                        </figcaption>
                      ) : null}
                    </figure>
                  );
                }
                if (part.type === 'structured-output' && part.status === 'complete') {
                  const hasStreamedText = message.parts.some(
                    (messagePart) => messagePart.type === 'text' && messagePart.content.trim().length > 0,
                  );
                  if (hasStreamedText) return null;
                  const result = ASSISTANT_FINAL_RESPONSE_SCHEMA.safeParse(part.data);
                  return result.success ? (
                    <CharacterAssistantMessageText key={partKey} content={result.data.assistantMessage} />
                  ) : null;
                }
                if (part.type === 'tool-call' && part.state === 'error') {
                  const toolError = readToolCallError(part.output);
                  return (
                    <div
                      key={partKey}
                      role="alert"
                      className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-destructive"
                    >
                      <LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
                      <p className="text-xs">{toolError}</p>
                    </div>
                  );
                }
                if (part.type !== 'tool-call' || !part.output) return null;
                const rendererKind = getAssistantToolRendererKind(part.name);
                if (rendererKind === ASSISTANT_TOOL_RENDERER_KINDS.proposal) {
                  const result = CHARACTER_EDIT_PROPOSAL_SCHEMA.safeParse(
                    (part.output as { proposal?: unknown }).proposal,
                  );
                  if (!result.success) return null;
                  const storedProposal = proposalsById.get(result.data.id);
                  if (!storedProposal && !isRunning) return null;
                  const proposal = storedProposal ?? result.data;
                  return (
                    <ProposalCard
                      key={partKey}
                      proposal={proposal}
                      onApply={onApply}
                      onReject={onReject}
                      onJumpToField={onJumpToField}
                    />
                  );
                }
                if (rendererKind === ASSISTANT_TOOL_RENDERER_KINDS.concept) {
                  return null;
                }
                if (rendererKind === ASSISTANT_TOOL_RENDERER_KINDS.discovery && onSendMessage) {
                  const result = z
                    .array(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA)
                    .safeParse((part.output as { cards?: unknown }).cards);
                  return result.success ? (
                    <DiscoveryCardGrid key={partKey} cards={result.data} onUseDirections={onSendMessage} />
                  ) : null;
                }
                return null;
              })
            )}
          </div>
          {!isRunning && (onDeleteFromMessage || (message.id === lastUserMessageId && onEditLastUserMessage)) ? (
            <div
              className={cn(
                'flex items-center gap-0.5 px-1 text-muted-foreground opacity-75 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {message.id === lastUserMessageId && onEditLastUserMessage && readEditableMessageText(message) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="size-6 p-0 hover:text-foreground"
                  aria-label="Edit latest message"
                  disabled={isUpdatingMessages}
                  onClick={(event) => {
                    const messageContainer = event.currentTarget.closest<HTMLElement>('[data-conversation-message]');
                    setEditingMessageWidth(messageContainer?.getBoundingClientRect().width ?? null);
                    setEditingMessageId(message.id);
                    setEditedMessage(readEditableMessageText(message) ?? '');
                  }}
                >
                  <LuPencil className="size-3.5" />
                </Button>
              ) : null}
              {onDeleteFromMessage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="size-6 p-0 hover:text-destructive"
                  aria-label="Delete from this message"
                  disabled={isUpdatingMessages}
                  onClick={() => setMessagePendingDeletion(message)}
                >
                  <LuTrash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
      <AlertDialog
        open={messagePendingDeletion !== null}
        onOpenChange={(nextIsOpen) => {
          if (!nextIsOpen) setMessagePendingDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletionCount === 1 ? 'this message' : `${deletionCount} messages`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected message and every message after it. Applied character changes are not reverted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!messagePendingDeletion || !onDeleteFromMessage) return;
                setIsUpdatingMessages(true);
                void onDeleteFromMessage(messagePendingDeletion.id)
                  .catch(() => undefined)
                  .finally(() => setIsUpdatingMessages(false));
                setMessagePendingDeletion(null);
                setEditingMessageId(null);
                setEditingMessageWidth(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {proposedPatchCount > 1 || unresolvedPatchCount > 1 ? (
        <div className="flex justify-end gap-2">
          {unresolvedPatchCount > 1 ? (
            <Button type="button" size="sm" variant="outline" onClick={onRejectAll}>
              Reject all
            </Button>
          ) : null}
          {proposedPatchCount > 1 ? (
            <Button type="button" size="sm" onClick={onApplyAll}>
              Apply all
            </Button>
          ) : null}
        </div>
      ) : null}
      <div aria-live="polite" aria-busy={isRunning}>
        {activityLabel ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LuLoaderCircle className="size-4 animate-spin" />
            {activityLabel}
          </div>
        ) : null}
      </div>
      <div ref={settledOutcomeRef}>
        {errorMessage ? (
          <div role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
