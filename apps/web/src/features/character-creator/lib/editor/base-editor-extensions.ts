import type { Extensions } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';

import { MacroHighlight } from './macro-highlight-extension';

export function buildBaseEditorExtensions({
  placeholder,
  doesAllowOriginalMacro = false,
  doesHighlightTemplateSlots = false,
  doesIncludeMacroHighlight = true,
}: {
  placeholder?: string;
  doesAllowOriginalMacro?: boolean;
  doesHighlightTemplateSlots?: boolean;
  doesIncludeMacroHighlight?: boolean;
} = {}): Extensions {
  return [
    Placeholder.configure({ placeholder: placeholder ?? '' }),
    ...(doesIncludeMacroHighlight
      ? [MacroHighlight.configure({ doesAllowOriginalMacro, doesHighlightTemplateSlots })]
      : []),
  ];
}
