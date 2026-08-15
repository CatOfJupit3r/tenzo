import type { UIMessage } from '@tanstack/ai-react';
import { useMemo, useState } from 'react';
import { LuChevronDown, LuExternalLink, LuFileText, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu';
import { z } from 'zod';

import { Button } from '@~/components/ui/button/button';
import { cn } from '@~/lib/utils';

import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from '../lib/assistant/assistant-final-response';
import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA,
  CHARACTER_CONCEPT_SCHEMA,
} from '../lib/assistant/character-assistant-contracts';
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
}: iCharacterAssistantConversationProps) {
  const proposalsById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const conversationMessages = useMemo(() => groupCharacterAssistantConversationMessages(messages), [messages]);
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
          aria-label={message.role === 'user' ? 'User message' : 'Assistant message'}
          className={cn(
            'grid max-w-[92%] gap-2 rounded-xl px-3 py-2 text-sm',
            message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'border bg-card',
          )}
        >
          {message.parts.map((part, partIndex) => {
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
            if (part.type !== 'tool-call' || !part.output) return null;
            const rendererKind = getAssistantToolRendererKind(part.name);
            if (rendererKind === ASSISTANT_TOOL_RENDERER_KINDS.proposal) {
              const result = CHARACTER_EDIT_PROPOSAL_SCHEMA.safeParse((part.output as { proposal?: unknown }).proposal);
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
              const result = CHARACTER_CONCEPT_SCHEMA.safeParse((part.output as { concept?: unknown }).concept);
              return result.success ? (
                <div key={partKey} className="rounded-md border bg-muted/30 p-2">
                  <p className="text-xs font-medium">Concept recorded</p>
                  <p className="mt-1 text-xs text-muted-foreground">{result.data.premise}</p>
                </div>
              ) : null;
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
          })}
        </div>
      ))}
      {proposals.length > 1 ? (
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onRejectAll}>
            Reject all
          </Button>
          <Button type="button" size="sm" onClick={onApplyAll}>
            Apply all
          </Button>
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
