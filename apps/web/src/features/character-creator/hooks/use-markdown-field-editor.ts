import { EDITOR_CONTENT_TYPES } from '@~/features/character-creator/lib/editor/editor-enums';

import { buildMarkdownEditorExtensions, MARKDOWN_EDITOR_SERIALIZER } from '../lib/editor/markdown-editor-extensions';
import type { iSyncedEditorHookOptions, SyncedEditorOverrideProps } from '../lib/editor/synced-editor-hook';
import { createSyncedEditorHook } from '../lib/editor/synced-editor-hook';
import type { iSyncedEditorContent } from './use-synced-field-editor';

export interface iUseMarkdownFieldEditorOptions
  extends Partial<SyncedEditorOverrideProps>, Omit<iSyncedEditorHookOptions, keyof SyncedEditorOverrideProps> {
  placeholder?: string;
  doesAllowOriginalMacro?: boolean;
  doesHighlightTemplateSlots?: boolean;
}

function toMarkdownEditorContent(value: string): iSyncedEditorContent {
  return { content: value, contentType: EDITOR_CONTENT_TYPES.MARKDOWN };
}

interface iNormalizedMarkdownFieldEditorOptions extends iUseMarkdownFieldEditorOptions {
  isReadOnly: boolean;
  isStreaming: boolean;
  editorAttributes: Record<string, string>;
}

const useCreatedMarkdownFieldEditor = createSyncedEditorHook<iNormalizedMarkdownFieldEditorOptions>({
  buildExtensions: ({ placeholder, doesAllowOriginalMacro, doesHighlightTemplateSlots }) =>
    buildMarkdownEditorExtensions({ placeholder, doesAllowOriginalMacro, doesHighlightTemplateSlots }),
  getExtensionDependencies: ({ placeholder, doesAllowOriginalMacro, doesHighlightTemplateSlots }) => [
    placeholder,
    doesAllowOriginalMacro,
    doesHighlightTemplateSlots,
  ],
  serializeValue: MARKDOWN_EDITOR_SERIALIZER.serialize,
  toEditorContent: toMarkdownEditorContent,
});

export function useMarkdownFieldEditor(options: iUseMarkdownFieldEditorOptions) {
  return useCreatedMarkdownFieldEditor({
    ...options,
    isReadOnly: options.isReadOnly ?? false,
    isStreaming: options.isStreaming ?? false,
    editorAttributes: options.editorAttributes ?? {},
  });
}
