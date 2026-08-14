import type { JSONContent } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';

import { cn } from '@~/lib/utils';

import { serializeChatInput } from '../../lib/editor/chat-input-serialization';
import { buildChatTemplateMentionExtension } from '../../lib/editor/chat-template-mention';
import type { iFieldTemplateViewModel } from '../../lib/field-templates';

interface iChatInputEditorProps {
  value: string;
  content?: JSONContent | null;
  templates: iFieldTemplateViewModel[];
  preferredFieldKeys?: readonly string[];
  isDisabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  onValueChange: (value: string, templateIds: string[], content: JSONContent) => void;
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
  content,
  templates,
  preferredFieldKeys,
  isDisabled = false,
  placeholder,
  ariaLabel,
  onValueChange,
  onSubmit,
}: iChatInputEditorProps) {
  const lastEmittedInputRef = useRef({ text: value, templateIds: [] as string[] });
  const lastDocumentRef = useRef(JSON.stringify(content ?? createInitialContent(value)));
  const onValueChangeRef = useRef(onValueChange);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      UndoRedo,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      buildChatTemplateMentionExtension({ templates, preferredFieldKeys }),
    ],
    content: content ?? createInitialContent(value),
    editable: !isDisabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
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
      const hasSameTemplateIds =
        serialized.templateIds.length === lastEmittedInputRef.current.templateIds.length &&
        serialized.templateIds.every(
          (templateId, index) => templateId === lastEmittedInputRef.current.templateIds[index],
        );
      if (serialized.text === lastEmittedInputRef.current.text && hasSameTemplateIds) {
        return;
      }
      lastEmittedInputRef.current = serialized;
      const document = updatedEditor.getJSON();
      lastDocumentRef.current = JSON.stringify(document);
      onValueChangeRef.current(serialized.text, serialized.templateIds, document);
    },
  });

  useEffect(() => {
    editor?.setEditable(!isDisabled);
  }, [editor, isDisabled]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (ariaLabel) {
      editor.view.dom.setAttribute('aria-label', ariaLabel);
      return;
    }

    editor.view.dom.removeAttribute('aria-label');
  }, [ariaLabel, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextContent = content ?? createInitialContent(value);
    const nextDocument = JSON.stringify(nextContent);
    if (lastDocumentRef.current === nextDocument) {
      return;
    }

    lastDocumentRef.current = nextDocument;
    lastEmittedInputRef.current = {
      text: value,
      templateIds: content ? serializeChatInput(content).templateIds : [],
    };

    if (value || content) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
      editor.commands.focus('end');
      return;
    }

    editor.commands.clearContent(false);
  }, [content, editor, value]);

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
