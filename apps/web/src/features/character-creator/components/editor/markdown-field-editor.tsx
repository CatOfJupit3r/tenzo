import { EditorContent } from '@tiptap/react';

import { cn } from '@~/lib/utils';

import { useMarkdownFieldEditor } from '../../hooks/use-markdown-field-editor';
import { MarkdownEditorToolbar } from './markdown-editor-toolbar';

export interface iMarkdownFieldEditorProps {
  fieldId: string;
  value: string;
  rows?: number;
  placeholder?: string;
  isReadOnly?: boolean;
  isStreaming?: boolean;
  doesAllowOriginalMacro?: boolean;
  ariaDescribedBy?: string;
  onValueChange: (value: string) => void;
}

const EDITOR_LINE_HEIGHT_PX = 24;
const EDITOR_VERTICAL_PADDING_PX = 16;
const EDITOR_MAX_HEIGHT_PX = 480;

export function MarkdownFieldEditor({
  fieldId,
  value,
  rows = 4,
  placeholder,
  isReadOnly = false,
  isStreaming = false,
  doesAllowOriginalMacro = false,
  ariaDescribedBy,
  onValueChange,
}: iMarkdownFieldEditorProps) {
  const { editor } = useMarkdownFieldEditor({
    value,
    isReadOnly,
    isStreaming,
    placeholder,
    doesAllowOriginalMacro,
    editorAttributes: {
      id: fieldId,
      role: 'textbox',
      'aria-multiline': 'true',
      ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
    },
    onValueChange,
  });

  return (
    <div
      className={cn(
        'w-full rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30',
        isReadOnly && 'opacity-70',
      )}
    >
      <MarkdownEditorToolbar editor={editor} isDisabled={isReadOnly} />
      <EditorContent
        editor={editor}
        className="character-markdown-editor overflow-y-auto"
        style={{
          minHeight: rows * EDITOR_LINE_HEIGHT_PX + EDITOR_VERTICAL_PADDING_PX,
          maxHeight: EDITOR_MAX_HEIGHT_PX,
        }}
      />
    </div>
  );
}
