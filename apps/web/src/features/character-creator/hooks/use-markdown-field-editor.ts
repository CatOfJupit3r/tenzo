import { useMemo } from 'react';

import { buildMarkdownEditorExtensions, serializeEditorMarkdown } from '../lib/editor/markdown-editor-extensions';
import type { iSyncedEditorContent } from './use-synced-field-editor';
import { useSyncedFieldEditor } from './use-synced-field-editor';

export interface iUseMarkdownFieldEditorOptions {
  value: string;
  isReadOnly?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  doesAllowOriginalMacro?: boolean;
  editorAttributes?: Record<string, string>;
  onValueChange: (value: string) => void;
}

function toMarkdownEditorContent(value: string): iSyncedEditorContent {
  return { content: value, contentType: 'markdown' };
}

export function useMarkdownFieldEditor({
  value,
  isReadOnly = false,
  isStreaming = false,
  placeholder,
  doesAllowOriginalMacro = false,
  editorAttributes = {},
  onValueChange,
}: iUseMarkdownFieldEditorOptions) {
  const extensions = useMemo(
    () => buildMarkdownEditorExtensions({ placeholder, doesAllowOriginalMacro }),
    [placeholder, doesAllowOriginalMacro],
  );

  return useSyncedFieldEditor({
    value,
    isReadOnly,
    isStreaming,
    editorAttributes,
    extensions,
    toEditorContent: toMarkdownEditorContent,
    serializeValue: serializeEditorMarkdown,
    onValueChange,
  });
}
