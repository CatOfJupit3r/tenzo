import { useEffect, useState } from 'react';
import { LuChevronDown, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu';

import { Button } from '@~/components/ui/button/button';
import { cn } from '@~/lib/utils';

import { GUIDED_STEP_DEFINITIONS } from '../constants/guided-flow';
import type { GuidedStepId } from '../constants/guided-step-id';
import { CHARACTER_ASSISTANT_MESSAGE_ROLES } from '../lib/character-assistant-contracts';
import type { iCharacterAssistantMessage } from '../lib/character-assistant-contracts';
import { CHARACTER_EDIT_PATCH_STATUSES } from '../lib/character-edit-proposal';
import type { CharacterEditFieldKey, iCharacterEditProposal } from '../lib/character-edit-proposal';

function formatFieldLabel(fieldKey: CharacterEditFieldKey) {
  return fieldKey
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

interface iConversationGroup {
  id: GuidedStepId | 'unscoped';
  label: string;
  messages: iCharacterAssistantMessage[];
  proposals: iCharacterEditProposal[];
}

function buildConversationGroups(
  messages: readonly iCharacterAssistantMessage[],
  proposals: readonly iCharacterEditProposal[],
) {
  const groupedEntries = new Map<iConversationGroup['id'], iConversationGroup>();
  const ensureGroup = (guidedStepId?: GuidedStepId) => {
    const id = guidedStepId ?? 'unscoped';
    const existingGroup = groupedEntries.get(id);

    if (existingGroup) {
      return existingGroup;
    }

    const group: iConversationGroup = {
      id,
      label: guidedStepId ? GUIDED_STEP_DEFINITIONS[guidedStepId].title : 'Earlier conversation',
      messages: [],
      proposals: [],
    };
    groupedEntries.set(id, group);
    return group;
  };

  messages.forEach((message) => ensureGroup(message.guidedStepId).messages.push(message));
  proposals.forEach((proposal) => ensureGroup(proposal.guidedStepId).proposals.push(proposal));
  return [...groupedEntries.values()];
}

interface iProposalListProps {
  proposals: readonly iCharacterEditProposal[];
  onApply: (proposalId: string, fieldKeys?: CharacterEditFieldKey[]) => void;
  onReject: (proposalId: string, fieldKeys: CharacterEditFieldKey[]) => void;
  onApplyAll: () => void;
  onRejectAll: () => void;
}

function ProposalList({ proposals, onApply, onReject, onApplyAll, onRejectAll }: iProposalListProps) {
  if (proposals.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 rounded-xl border bg-muted/15 p-3" aria-label="Assistant proposals">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Proposed changes</p>
          <p className="text-xs text-muted-foreground">Detailed diffs also appear beside the affected fields.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onRejectAll}>
            Reject all
          </Button>
          <Button type="button" size="sm" onClick={onApplyAll}>
            Apply all
          </Button>
        </div>
      </div>

      {proposals.map((proposal) => (
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
                        onClick={() => onReject(proposal.id, [patch.fieldKey])}
                      >
                        Reject
                      </Button>
                      <Button type="button" size="sm" onClick={() => onApply(proposal.id, [patch.fieldKey])}>
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
  );
}

interface iConversationGroupViewProps extends Omit<iProposalListProps, 'proposals'> {
  group: iConversationGroup;
  isLabelVisible: boolean;
}

function ConversationGroupView({ group, isLabelVisible, ...proposalProps }: iConversationGroupViewProps) {
  return (
    <section className="grid gap-3" aria-label={isLabelVisible ? `${group.label} conversation` : undefined}>
      {isLabelVisible ? (
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</h3>
      ) : null}
      <div className="grid gap-3">
        {group.messages.map((message) => (
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
      <ProposalList {...proposalProps} proposals={group.proposals} />
    </section>
  );
}

export interface iCharacterAssistantConversationProps extends Omit<iProposalListProps, 'proposals'> {
  messages: readonly iCharacterAssistantMessage[];
  proposals: readonly iCharacterEditProposal[];
  currentGuidedStepId?: GuidedStepId;
  isGuided: boolean;
  isRunning: boolean;
  activityLabel: string | null;
  errorMessage: string | null;
  settledOutcomeRef: React.RefObject<HTMLDivElement | null>;
}

export function CharacterAssistantConversation({
  messages,
  proposals,
  currentGuidedStepId,
  isGuided,
  isRunning,
  activityLabel,
  errorMessage,
  settledOutcomeRef,
  ...proposalProps
}: iCharacterAssistantConversationProps) {
  const [isPreviousStepsVisible, setIsPreviousStepsVisible] = useState(false);
  const groups = buildConversationGroups(messages, proposals);
  const currentGroup = currentGuidedStepId
    ? (groups.find((group) => group.id === currentGuidedStepId) ?? {
        id: currentGuidedStepId,
        label: GUIDED_STEP_DEFINITIONS[currentGuidedStepId].title,
        messages: [],
        proposals: [],
      })
    : null;
  const previousGroups = currentGroup ? groups.filter((group) => group.id !== currentGroup.id) : [];

  useEffect(() => {
    setIsPreviousStepsVisible(false);
  }, [currentGuidedStepId]);

  const hasContent = messages.length > 0 || proposals.length > 0;

  return (
    <div className="grid gap-4">
      {!hasContent ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Describe the character or ask for a focused change. Suggestions appear on their native fields for review.
        </div>
      ) : null}

      {isGuided && currentGroup ? (
        <>
          {previousGroups.length > 0 ? (
            <div className="grid gap-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-fit"
                aria-expanded={isPreviousStepsVisible}
                onClick={() => setIsPreviousStepsVisible((isVisible) => !isVisible)}
              >
                <LuChevronDown className={cn('size-4 transition-transform', isPreviousStepsVisible && 'rotate-180')} />
                {isPreviousStepsVisible ? 'Hide previous steps' : 'Show previous steps'}
              </Button>
              {isPreviousStepsVisible ? (
                <div className="grid gap-5 border-l pl-3">
                  {previousGroups.map((group) => (
                    <ConversationGroupView key={group.id} group={group} isLabelVisible {...proposalProps} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <ConversationGroupView group={currentGroup} isLabelVisible {...proposalProps} />
        </>
      ) : (
        groups.map((group) => (
          <ConversationGroupView key={group.id} group={group} isLabelVisible={groups.length > 1} {...proposalProps} />
        ))
      )}

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
