import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect } from 'react';

import { cn } from '@~/lib/utils';

import { serializeChatInput } from '../../lib/editor/chat-input-serialization';
import { buildChatTemplateMentionExtension } from '../../lib/editor/chat-template-mention';
import type { iFieldTemplateViewModel } from '../../lib/field-templates';

interface iChatInputEditorProps {
  value: string;
  templates: iFieldTemplateViewModel[];
  preferredFieldKeys?: readonly string[];
  isDisabled?: boolean;
  placeholder?: string;
  onValueChange: (value: string, templateIds: string[]) => void;
  onSubmit: () => void;
}

function createInitialContent(value: string) {
  return {
    type: 'doc' as const,
    content: [
      {
        type: 'paragraph' as const,
        content: value ? [{ type: 'text' as const, text: value }] : [],
      },
    ],
  };
}

export function ChatInputEditor({
  value,
  templates,
  preferredFieldKeys,
  isDisabled = false,
  placeholder,
  onValueChange,
  onSubmit,
}: iChatInputEditorProps) {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      UndoRedo,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      buildChatTemplateMentionExtension({ templates, preferredFieldKeys }),
    ],
    content: createInitialContent(value),
    editable: !isDisabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'min-h-20 max-h-36 overflow-y-auto px-3 py-2 text-sm outline-none',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const serialized = serializeChatInput(updatedEditor.getJSON());
      onValueChange(serialized.text, serialized.templateIds);
    },
  });

  useEffect(() => {
    editor?.setEditable(!isDisabled);
  }, [editor, isDisabled]);

  useEffect(() => {
    if (!editor || value || editor.isEmpty) {
      return;
    }

    editor.commands.clearContent();
  }, [editor, value]);

  return (
    <div
      className={cn(
        'w-full rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30',
        isDisabled && 'opacity-70',
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
