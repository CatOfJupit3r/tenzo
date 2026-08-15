import { EditorContent } from '@tiptap/react';

import { useMarkdownFieldEditor } from '../../hooks/use-markdown-field-editor';

function ignoreMessageTextChange() {}

export function CharacterAssistantMessageText({ content }: { content: string }) {
  const { editor } = useMarkdownFieldEditor({
    value: content,
    isReadOnly: true,
    isStreaming: false,
    onValueChange: ignoreMessageTextChange,
  });

  return (
    <EditorContent
      editor={editor}
      className="character-markdown-editor [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:p-0 [&_.ProseMirror]:text-sm"
    />
  );
}
