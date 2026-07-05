import type { Editor } from '@tiptap/core';
import { useMemo } from 'react';

import {
  buildMesExampleExtensions,
  parseMesExampleToDoc,
  serializeMesExampleDoc,
} from '../lib/editor/mes-example-extensions';
import type { iSyncedEditorContent } from './use-synced-field-editor';
import { useSyncedFieldEditor } from './use-synced-field-editor';

export interface iUseMesExampleEditorOptions {
  value: string;
  isReadOnly?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  editorAttributes?: Record<string, string>;
  onValueChange: (value: string) => void;
}

function toMesExampleEditorContent(value: string): iSyncedEditorContent {
  return { content: parseMesExampleToDoc(value), contentType: 'json' };
}

function serializeMesExampleEditor(editor: Editor): string {
  return serializeMesExampleDoc(editor.state.doc);
}

export function useMesExampleEditor({
  value,
  isReadOnly = false,
  isStreaming = false,
  placeholder,
  editorAttributes = {},
  onValueChange,
}: iUseMesExampleEditorOptions) {
  const extensions = useMemo(() => buildMesExampleExtensions({ placeholder }), [placeholder]);

  return useSyncedFieldEditor({
    value,
    isReadOnly,
    isStreaming,
    editorAttributes,
    extensions,
    toEditorContent: toMesExampleEditorContent,
    serializeValue: serializeMesExampleEditor,
    onValueChange,
  });
}
