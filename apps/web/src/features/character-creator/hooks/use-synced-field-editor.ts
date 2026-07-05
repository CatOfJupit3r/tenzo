import type { Content, Editor, Extensions } from '@tiptap/core';
import { useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';

export interface iSyncedEditorContent {
  content: Content;
  contentType: 'json' | 'markdown';
}

export interface iUseSyncedFieldEditorOptions {
  value: string;
  isReadOnly: boolean;
  isStreaming: boolean;
  editorAttributes: Record<string, string>;
  extensions: Extensions;
  toEditorContent: (value: string) => iSyncedEditorContent;
  serializeValue: (editor: Editor) => string;
  onValueChange: (value: string) => void;
}

export function useSyncedFieldEditor({
  value,
  isReadOnly,
  isStreaming,
  editorAttributes,
  extensions,
  toEditorContent,
  serializeValue,
  onValueChange,
}: iUseSyncedFieldEditorOptions) {
  const lastEmittedValueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const serializeValueRef = useRef(serializeValue);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
    serializeValueRef.current = serializeValue;
  });

  const initialContent = useRef(toEditorContent(value)).current;

  const editor = useEditor({
    extensions,
    content: initialContent.content,
    contentType: initialContent.contentType,
    editable: !isReadOnly,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: editorAttributes,
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const serialized = serializeValueRef.current(updatedEditor);
      lastEmittedValueRef.current = serialized;
      onValueChangeRef.current(serialized);
    },
  });

  useEffect(() => {
    if (!editor || value === lastEmittedValueRef.current) {
      return;
    }
    lastEmittedValueRef.current = value;
    const { content, contentType } = toEditorContent(value);
    editor.commands.setContent(content, { emitUpdate: false, contentType });
    if (isStreaming) {
      const scrollParent = editor.view.dom.parentElement;
      if (scrollParent) {
        scrollParent.scrollTop = scrollParent.scrollHeight;
      }
    }
    // toEditorContent is a stable module-level converter; only value changes matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value, isStreaming]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!isReadOnly, false);
  }, [editor, isReadOnly]);

  return { editor };
}
