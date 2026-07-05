import { describe, expect, it } from 'vitest';

import { REWRITE_HUNK_DECISIONS, computeRewriteDiffHunks, getHunkLines, mergeRewriteDiffHunks } from './rewrite-diff';

const OLD_VALUE = 'shared intro\nold detail line\nshared middle\nold ending\n';
const NEW_VALUE = 'shared intro\nnew detail line\nshared middle\nnew ending\n';

describe('computeRewriteDiffHunks', () => {
  it('returns a single context hunk for identical inputs', () => {
    const hunks = computeRewriteDiffHunks('same\ntext', 'same\ntext');
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.isChanged).toBe(false);
  });

  it('coalesces adjacent removed and added runs into one changed hunk', () => {
    const hunks = computeRewriteDiffHunks(OLD_VALUE, NEW_VALUE);
    expect(hunks.map((hunk) => hunk.isChanged)).toEqual([false, true, false, true]);
    expect(hunks[1]?.oldText).toBe('old detail line\n');
    expect(hunks[1]?.newText).toBe('new detail line\n');
  });

  it('handles pure insertions', () => {
    const hunks = computeRewriteDiffHunks('a\nb\n', 'a\ninserted\nb\n');
    const changed = hunks.filter((hunk) => hunk.isChanged);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.oldText).toBe('');
    expect(changed[0]?.newText).toBe('inserted\n');
  });

  it('handles pure deletions', () => {
    const hunks = computeRewriteDiffHunks('a\nremoved\nb\n', 'a\nb\n');
    const changed = hunks.filter((hunk) => hunk.isChanged);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.oldText).toBe('removed\n');
    expect(changed[0]?.newText).toBe('');
  });

  it('handles a full replacement', () => {
    const hunks = computeRewriteDiffHunks('entirely old', 'entirely new');
    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({ isChanged: true, oldText: 'entirely old', newText: 'entirely new' });
  });
});

describe('mergeRewriteDiffHunks', () => {
  it('reproduces the new value when every decision keeps new', () => {
    const hunks = computeRewriteDiffHunks(OLD_VALUE, NEW_VALUE);
    expect(mergeRewriteDiffHunks(hunks, {})).toBe(NEW_VALUE);
  });

  it('reproduces the old value when every decision keeps old', () => {
    const hunks = computeRewriteDiffHunks(OLD_VALUE, NEW_VALUE);
    const decisions = Object.fromEntries(
      hunks.filter((hunk) => hunk.isChanged).map((hunk) => [hunk.id, REWRITE_HUNK_DECISIONS.keepOld]),
    );
    expect(mergeRewriteDiffHunks(hunks, decisions)).toBe(OLD_VALUE);
  });

  it('mixes decisions per hunk', () => {
    const hunks = computeRewriteDiffHunks(OLD_VALUE, NEW_VALUE);
    const changedIds = hunks.filter((hunk) => hunk.isChanged).map((hunk) => hunk.id);
    const merged = mergeRewriteDiffHunks(hunks, {
      [changedIds[0] ?? 0]: REWRITE_HUNK_DECISIONS.keepOld,
      [changedIds[1] ?? 0]: REWRITE_HUNK_DECISIONS.keepNew,
    });
    expect(merged).toBe('shared intro\nold detail line\nshared middle\nnew ending\n');
  });

  it('keeps both texts stacked when asked', () => {
    const hunks = computeRewriteDiffHunks('old line\n', 'new line\n');
    const merged = mergeRewriteDiffHunks(hunks, { 0: REWRITE_HUNK_DECISIONS.keepBoth });
    expect(merged).toBe('old line\nnew line\n');
  });

  it('inserts a newline when keeping both and the old text lacks one', () => {
    const hunks = computeRewriteDiffHunks('old ending', 'new ending');
    const merged = mergeRewriteDiffHunks(hunks, { 0: REWRITE_HUNK_DECISIONS.keepBoth });
    expect(merged).toBe('old ending\nnew ending');
  });

  it('preserves values without trailing newlines', () => {
    const hunks = computeRewriteDiffHunks('a\nold', 'a\nnew');
    expect(mergeRewriteDiffHunks(hunks, {})).toBe('a\nnew');
  });
});

describe('getHunkLines', () => {
  it('splits text into lines without a phantom trailing entry', () => {
    expect(getHunkLines('a\nb\n')).toEqual(['a', 'b']);
    expect(getHunkLines('a\nb')).toEqual(['a', 'b']);
    expect(getHunkLines('')).toEqual([]);
  });
});
