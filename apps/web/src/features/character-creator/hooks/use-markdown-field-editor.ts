import { buildMarkdownEditorExtensions, MARKDOWN_EDITOR_SERIALIZER } from '../lib/editor/markdown-editor-extensions';
import { createSyncedEditorHook } from '../lib/editor/synced-editor-hook';
import type { iSyncedEditorHookOptions } from '../lib/editor/synced-editor-hook';
import type { iSyncedEditorContent } from './use-synced-field-editor';

export interface iUseMarkdownFieldEditorOptions
  extends
    Partial<Pick<iSyncedEditorHookOptions, 'isReadOnly' | 'isStreaming' | 'editorAttributes'>>,
    Omit<iSyncedEditorHookOptions, 'isReadOnly' | 'isStreaming' | 'editorAttributes'> {
  placeholder?: string;
  doesAllowOriginalMacro?: boolean;
  doesHighlightTemplateSlots?: boolean;
}

function toMarkdownEditorContent(value: string): iSyncedEditorContent {
  return { content: value, contentType: 'markdown' };
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
