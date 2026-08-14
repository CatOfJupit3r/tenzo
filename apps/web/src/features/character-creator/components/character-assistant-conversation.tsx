import type { UIMessage } from '@tanstack/ai-react';
import { useMemo, useState } from 'react';
import { LuChevronDown, LuExternalLink, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu';
import { z } from 'zod';

import { Button } from '@~/components/ui/button/button';
import { cn } from '@~/lib/utils';

import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from '../lib/assistant/assistant-final-response';
import { ASSISTANT_TOOL_RENDERER_KINDS, getAssistantToolRendererKind } from '../lib/assistant/tool-part-renderers';
import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA,
  CHARACTER_CONCEPT_SCHEMA,
} from '../lib/character-assistant-contracts';
import { CHARACTER_EDIT_PATCH_STATUSES, CHARACTER_EDIT_PROPOSAL_SCHEMA } from '../lib/character-edit-proposal';
import type {
  CharacterEditFieldKey,
  iCharacterEditPatch,
  iCharacterEditProposal,
} from '../lib/character-edit-proposal';
import { computeRewriteDiffHunks } from '../lib/editor/rewrite-diff';
import { DiscoveryCardGrid } from './assistant/discovery-card-grid';

function formatFieldLabel(fieldKey: CharacterEditFieldKey) {
  return fieldKey
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function stringifyPatchValue(patch: iCharacterEditPatch, side: 'old' | 'new') {
  const value = side === 'old' ? patch.oldValue : patch.newValue;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
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
  return (
    <section className="grid gap-2 rounded-xl border bg-muted/15 p-3" aria-label="Assistant proposal">
      <p className="text-sm font-medium">{proposal.summary ?? 'Proposed changes'}</p>
      {proposal.patches.map((patch) => {
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
  return (
    <div className="grid gap-4">
      {messages.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Describe the character, ask for a focused change, or choose a suggestion below.
        </div>
      ) : null}
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'grid max-w-[92%] gap-2 rounded-xl px-3 py-2 text-sm',
            message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'border bg-card',
          )}
        >
          {message.parts.map((part) => {
            let partKey: string = part.type;
            if (part.type === 'tool-call') partKey = part.id;
            if (part.type === 'text') partKey = `text-${part.content}`;
            if (part.type === 'text')
              return (
                <p key={partKey} className="whitespace-pre-wrap">
                  {part.content}
                </p>
              );
            if (part.type === 'structured-output' && part.status === 'complete') {
              const result = ASSISTANT_FINAL_RESPONSE_SCHEMA.safeParse(part.data);
              return result.success ? (
                <p key={partKey} className="whitespace-pre-wrap">
                  {result.data.assistantMessage}
                </p>
              ) : null;
            }
            if (part.type !== 'tool-call' || !part.output) return null;
            const rendererKind = getAssistantToolRendererKind(part.name);
            if (rendererKind === ASSISTANT_TOOL_RENDERER_KINDS.proposal) {
              const result = CHARACTER_EDIT_PROPOSAL_SCHEMA.safeParse((part.output as { proposal?: unknown }).proposal);
              if (!result.success) return null;
              const proposal = proposalsById.get(result.data.id) ?? result.data;
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
