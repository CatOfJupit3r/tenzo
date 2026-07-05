import { diffWordsWithSpace } from 'diff';
import { useMemo, useState } from 'react';
import { LuCheck, LuUndo2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { cn } from '@~/lib/utils';

import type { RewriteHunkDecision, iRewriteDiffHunk } from '../../lib/editor/rewrite-diff';
import {
  REWRITE_HUNK_DECISIONS,
  computeRewriteDiffHunks,
  getHunkLines,
  mergeRewriteDiffHunks,
} from '../../lib/editor/rewrite-diff';

export interface iRewriteDiffReviewProps {
  oldValue: string;
  newValue: string;
  onResolve: (mergedValue: string) => void;
  onAcceptAll: () => void;
  onRevertAll: () => void;
}

const CONTEXT_PREVIEW_LINES = 2;

const REWRITE_HUNK_DECISION_VALUES = [
  REWRITE_HUNK_DECISIONS.keepNew,
  REWRITE_HUNK_DECISIONS.keepOld,
  REWRITE_HUNK_DECISIONS.keepBoth,
] as const;

const DECISION_LABELS = {
  [REWRITE_HUNK_DECISIONS.keepNew]: 'New',
  [REWRITE_HUNK_DECISIONS.keepOld]: 'Old',
  [REWRITE_HUNK_DECISIONS.keepBoth]: 'Both',
} satisfies Record<RewriteHunkDecision, string>;

interface iWordDiffTextProps {
  hunk: iRewriteDiffHunk;
  side: 'old' | 'new';
}

function WordDiffText({ hunk, side }: iWordDiffTextProps) {
  const parts = useMemo(() => diffWordsWithSpace(hunk.oldText, hunk.newText), [hunk]);
  return (
    <>
      {parts.map((part, index) => {
        if (side === 'old' && part.added) {
          return null;
        }
        if (side === 'new' && part.removed) {
          return null;
        }
        const isEmphasized = part.added || part.removed;
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={cn(
              isEmphasized && side === 'old' && 'bg-destructive/25',
              isEmphasized && side === 'new' && 'bg-chart-2/25',
            )}
          >
            {part.value}
          </span>
        );
      })}
    </>
  );
}

function ContextLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <p key={index} className="whitespace-pre-wrap">
          {line || ' '}
        </p>
      ))}
    </>
  );
}

interface iContextHunkProps {
  hunk: iRewriteDiffHunk;
}

function ContextHunk({ hunk }: iContextHunkProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = getHunkLines(hunk.newText);
  const isCollapsed = lines.length > CONTEXT_PREVIEW_LINES * 2 + 1 && !isExpanded;

  if (!isCollapsed) {
    return (
      <div className="px-3 py-1 text-muted-foreground">
        <ContextLines lines={lines} />
      </div>
    );
  }

  return (
    <div className="px-3 py-1 text-muted-foreground">
      <ContextLines lines={lines.slice(0, CONTEXT_PREVIEW_LINES)} />
      <button
        type="button"
        className="my-0.5 w-full rounded-sm bg-muted/50 py-0.5 text-center text-xs hover:bg-muted"
        onClick={() => setIsExpanded(true)}
      >
        Show {lines.length - CONTEXT_PREVIEW_LINES * 2} more lines
      </button>
      <ContextLines lines={lines.slice(-CONTEXT_PREVIEW_LINES)} />
    </div>
  );
}

interface iChangedHunkProps {
  hunk: iRewriteDiffHunk;
  decision: RewriteHunkDecision;
  onDecisionChange: (decision: RewriteHunkDecision) => void;
}

function ChangedHunk({ hunk, decision, onDecisionChange }: iChangedHunkProps) {
  const isKeepingOld = decision !== REWRITE_HUNK_DECISIONS.keepNew;
  const isKeepingNew = decision !== REWRITE_HUNK_DECISIONS.keepOld;

  return (
    <div className="border-y border-border/60">
      <div className="flex items-center justify-end gap-0.5 bg-muted/40 px-2 py-0.5">
        {REWRITE_HUNK_DECISION_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={cn(
              'rounded-sm px-2 py-0.5 text-xs',
              decision === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            onClick={() => onDecisionChange(value)}
          >
            {DECISION_LABELS[value]}
          </button>
        ))}
      </div>
      {hunk.oldText.length > 0 ? (
        <div className={cn('bg-destructive/10 px-3 py-1', !isKeepingOld && 'line-through opacity-45')}>
          <div className="whitespace-pre-wrap">
            <WordDiffText hunk={hunk} side="old" />
          </div>
        </div>
      ) : null}
      {hunk.newText.length > 0 ? (
        <div className={cn('bg-chart-2/10 px-3 py-1', !isKeepingNew && 'line-through opacity-45')}>
          <div className="whitespace-pre-wrap">
            <WordDiffText hunk={hunk} side="new" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RewriteDiffReview({
  oldValue,
  newValue,
  onResolve,
  onAcceptAll,
  onRevertAll,
}: iRewriteDiffReviewProps) {
  const hunks = useMemo(() => computeRewriteDiffHunks(oldValue, newValue), [oldValue, newValue]);
  const [decisions, setDecisions] = useState<Record<number, RewriteHunkDecision>>({});

  const hasCustomDecisions = Object.values(decisions).some((decision) => decision !== REWRITE_HUNK_DECISIONS.keepNew);

  return (
    <div className="w-full rounded-md border border-input shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-input bg-muted/40 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Review rewrite</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onRevertAll}>
            <LuUndo2 className="size-3.5" />
            Revert all
          </Button>
          {hasCustomDecisions ? (
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onResolve(mergeRewriteDiffHunks(hunks, decisions))}
            >
              <LuCheck className="size-3.5" />
              Apply choices
            </Button>
          ) : (
            <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={onAcceptAll}>
              <LuCheck className="size-3.5" />
              Accept all
            </Button>
          )}
        </div>
      </div>
      <div className="max-h-[480px] overflow-y-auto py-1 text-base md:text-sm">
        {hunks.map((hunk) =>
          hunk.isChanged ? (
            <ChangedHunk
              key={hunk.id}
              hunk={hunk}
              decision={decisions[hunk.id] ?? REWRITE_HUNK_DECISIONS.keepNew}
              onDecisionChange={(decision) => setDecisions((prev) => ({ ...prev, [hunk.id]: decision }))}
            />
          ) : (
            <ContextHunk key={hunk.id} hunk={hunk} />
          ),
        )}
      </div>
    </div>
  );
}
