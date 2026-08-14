import type { Editor } from '@tiptap/core';

export interface iEditorSerializer<TSource = Editor, TResult = string> {
  serialize: (source: TSource) => TResult;
}

export function buildEditorAccessibilityAttributes({
  id,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
}: {
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  className?: string;
}) {
  return {
    ...(id ? { id } : {}),
    role: 'textbox',
    'aria-multiline': 'true',
    ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
    ...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {}),
    ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
    ...(className ? { class: className } : {}),
  };
}
