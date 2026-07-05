import type { Editor, Extensions } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { StarterKit } from '@tiptap/starter-kit';

import { MacroHighlight } from './macro-highlight-extension';

export interface iBuildMarkdownEditorExtensionsOptions {
  placeholder?: string;
  doesAllowOriginalMacro?: boolean;
}

const INTRAWORD_ESCAPED_UNDERSCORE_PATTERN = /(?<=\w)\\_(?=\w)/g;

export function serializeEditorMarkdown(editor: Editor): string {
  // The serializer backslash-escapes every literal underscore, but intraword
  // underscores (snake_case) can never form emphasis in CommonMark, so
  // unescaping them is lossless and keeps stored card text clean.
  return editor.getMarkdown().replace(INTRAWORD_ESCAPED_UNDERSCORE_PATTERN, '_');
}

export function buildMarkdownEditorExtensions(options: iBuildMarkdownEditorExtensionsOptions = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: false, linkOnPaste: false },
      underline: false,
    }),
    Markdown,
    Placeholder.configure({ placeholder: options.placeholder ?? '' }),
    MacroHighlight.configure({ doesAllowOriginalMacro: options.doesAllowOriginalMacro ?? false }),
  ];
}
