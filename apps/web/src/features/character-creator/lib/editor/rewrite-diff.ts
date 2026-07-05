import { diffLines } from 'diff';
import z from 'zod';

export const rewriteHunkDecisionSchema = z.enum(['keepNew', 'keepOld', 'keepBoth']);
export const REWRITE_HUNK_DECISIONS = rewriteHunkDecisionSchema.enum;
export type RewriteHunkDecision = z.infer<typeof rewriteHunkDecisionSchema>;

export interface iRewriteDiffHunk {
  id: number;
  oldText: string;
  newText: string;
  isChanged: boolean;
}

export function computeRewriteDiffHunks(oldValue: string, newValue: string): iRewriteDiffHunk[] {
  const changes = diffLines(oldValue, newValue);
  const hunks: iRewriteDiffHunk[] = [];
  let index = 0;

  while (index < changes.length) {
    const change = changes[index];
    if (!change) {
      break;
    }
    if (!change.added && !change.removed) {
      hunks.push({ id: hunks.length, oldText: change.value, newText: change.value, isChanged: false });
      index += 1;
      continue;
    }
    let oldText = '';
    let newText = '';
    while (index < changes.length) {
      const run = changes[index];
      if (!run || (!run.added && !run.removed)) {
        break;
      }
      if (run.removed) {
        oldText += run.value;
      } else {
        newText += run.value;
      }
      index += 1;
    }
    hunks.push({ id: hunks.length, oldText, newText, isChanged: true });
  }

  return hunks;
}

function joinKeepBoth(oldText: string, newText: string): string {
  if (oldText.length > 0 && newText.length > 0 && !oldText.endsWith('\n')) {
    return `${oldText}\n${newText}`;
  }
  return oldText + newText;
}

export function mergeRewriteDiffHunks(
  hunks: iRewriteDiffHunk[],
  decisions: Record<number, RewriteHunkDecision>,
): string {
  return hunks
    .map((hunk) => {
      if (!hunk.isChanged) {
        return hunk.newText;
      }
      const decision = decisions[hunk.id] ?? REWRITE_HUNK_DECISIONS.keepNew;
      if (decision === REWRITE_HUNK_DECISIONS.keepOld) {
        return hunk.oldText;
      }
      if (decision === REWRITE_HUNK_DECISIONS.keepBoth) {
        return joinKeepBoth(hunk.oldText, hunk.newText);
      }
      return hunk.newText;
    })
    .join('');
}

export function getHunkLines(text: string): string[] {
  if (text.length === 0) {
    return [];
  }
  const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
  return withoutTrailingNewline.split('\n');
}
