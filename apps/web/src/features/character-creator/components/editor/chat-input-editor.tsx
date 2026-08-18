import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';
import { LuBold, LuFileText, LuImage, LuItalic, LuPaperclip, LuStrikethrough, LuX } from 'react-icons/lu';

import { Button } from '@~/components/ui/button/button';
import { Toggle } from '@~/components/ui/toggle';
import { cn } from '@~/lib/utils';

import type { iFieldTemplateViewModel } from '../../lib/cards/field-templates';
import { buildBaseEditorExtensions } from '../../lib/editor/base-editor-extensions';
import {
  CHAT_INPUT_ATTACHMENT_ACCEPT,
  CHAT_INPUT_ATTACHMENT_KINDS,
  createChatInputAttachments,
} from '../../lib/editor/chat-input-attachments';
import type { iChatInputAttachment } from '../../lib/editor/chat-input-attachments';
import { CHAT_INPUT_EDITOR_SERIALIZER } from '../../lib/editor/chat-input-serialization';
import {
  buildChatTemplateMentionExtension,
  parseChatTemplateMentionReference,
} from '../../lib/editor/chat-template-mention';
import type { iChatTemplateMentionReference } from '../../lib/editor/chat-template-mention';
import { buildEditorAccessibilityAttributes } from '../../lib/editor/editor-contracts';
import { createEditorHook } from '../../lib/editor/synced-editor-hook';

interface iChatInputEditorProps {
  value: string;
  content?: JSONContent | null;
  templates: iFieldTemplateViewModel[];
  preferredFieldKeys?: readonly string[];
  isDisabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  attachments?: iChatInputAttachment[];
  onAttachmentsChange?: (attachments: iChatInputAttachment[]) => void;
  onValueChange: (value: string, templateIds: string[], content: JSONContent) => void;
  onTemplateClick?: (reference: iChatTemplateMentionReference) => void;
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

interface iChatInputEditorHookOptions {
  content: JSONContent;
  templates: iFieldTemplateViewModel[];
  preferredFieldKeys?: readonly string[];
  isDisabled: boolean;
  placeholder?: string;
  ariaLabel?: string;
  onSubmit: () => void;
  onTemplateClick?: (reference: iChatTemplateMentionReference) => void;
  onUpdate: (content: JSONContent) => void;
}

const useCreatedChatInputEditor = createEditorHook<iChatInputEditorHookOptions>({
  buildExtensions: ({ templates, preferredFieldKeys, placeholder }) => [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      link: false,
      listItem: false,
      orderedList: false,
      underline: false,
    }),
    ...buildBaseEditorExtensions({ placeholder }),
    buildChatTemplateMentionExtension({ templates, preferredFieldKeys }),
  ],
  getExtensionDependencies: ({ templates, preferredFieldKeys, placeholder }) => [
    templates,
    preferredFieldKeys,
    placeholder,
  ],
  buildEditorOptions: ({ content, isDisabled, ariaLabel, onSubmit, onTemplateClick, onUpdate }) => ({
    content,
    editable: !isDisabled,
    editorProps: {
      attributes: buildEditorAccessibilityAttributes({
        ariaLabel,
        className: 'min-h-20 max-h-36 overflow-y-auto px-3 py-2 text-sm outline-none',
      }),
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
      handleClick: (view, position) => {
        if (!onTemplateClick) return false;
        const resolvedPosition = view.state.doc.resolve(position);
        const mentionNode = resolvedPosition.nodeAfter ?? resolvedPosition.nodeBefore;
        if (mentionNode?.type.name !== 'mention') return false;
        const mentionReference = parseChatTemplateMentionReference(mentionNode.attrs);
        if (!mentionReference) return false;
        onTemplateClick(mentionReference);
        return true;
      },
    },
    onUpdate: ({ editor }) => onUpdate(editor.getJSON()),
  }),
});

export function ChatInputEditor({
  value,
  content,
  templates,
  preferredFieldKeys,
  isDisabled = false,
  placeholder,
  ariaLabel,
  attachments = [],
  onAttachmentsChange,
  onValueChange,
  onTemplateClick,
  onSubmit,
}: iChatInputEditorProps) {
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedInputRef = useRef({ text: value, templateIds: [] as string[] });
  const lastDocumentRef = useRef(JSON.stringify(content ?? createInitialContent(value)));
  const onValueChangeRef = useRef(onValueChange);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  const editor = useCreatedChatInputEditor({
    content: content ?? createInitialContent(value),
    templates,
    preferredFieldKeys,
    isDisabled,
    placeholder,
    ariaLabel,
    onTemplateClick,
    onSubmit,
    onUpdate: (document) => {
      const serialized = CHAT_INPUT_EDITOR_SERIALIZER.serialize(document);
      const hasSameTemplateIds =
        serialized.templateIds.length === lastEmittedInputRef.current.templateIds.length &&
        serialized.templateIds.every(
          (templateId, index) => templateId === lastEmittedInputRef.current.templateIds[index],
        );
      if (serialized.text === lastEmittedInputRef.current.text && hasSameTemplateIds) {
        return;
      }
      lastEmittedInputRef.current = serialized;
      lastDocumentRef.current = JSON.stringify(document);
      onValueChangeRef.current(serialized.text, serialized.templateIds, document);
    },
  });
  const textStyleState = useEditorState({
    editor,
    selector: ({ editor: selectedEditor }) => ({
      isBoldActive: selectedEditor?.isActive('bold') ?? false,
      isItalicActive: selectedEditor?.isActive('italic') ?? false,
      isStrikeActive: selectedEditor?.isActive('strike') ?? false,
    }),
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
      templateIds: content ? CHAT_INPUT_EDITOR_SERIALIZER.serialize(content).templateIds : [],
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
      {editor ? (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top', offset: 8 }}
          shouldShow={({ editor: selectedEditor, from, to }) => selectedEditor.isEditable && from !== to}
        >
          <div className="flex items-center gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <Toggle
              type="button"
              size="sm"
              className="size-8 p-0"
              aria-label="Bold"
              pressed={textStyleState?.isBoldActive ?? false}
              onPressedChange={() => editor.chain().focus().toggleBold().run()}
            >
              <LuBold className="size-4" />
            </Toggle>
            <Toggle
              type="button"
              size="sm"
              className="size-8 p-0"
              aria-label="Italic"
              pressed={textStyleState?.isItalicActive ?? false}
              onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            >
              <LuItalic className="size-4" />
            </Toggle>
            <Toggle
              type="button"
              size="sm"
              className="size-8 p-0"
              aria-label="Strikethrough"
              pressed={textStyleState?.isStrikeActive ?? false}
              onPressedChange={() => editor.chain().focus().toggleStrike().run()}
            >
              <LuStrikethrough className="size-4" />
            </Toggle>
          </div>
        </BubbleMenu>
      ) : null}
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b border-input px-2 py-2" aria-label="Attached files">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex max-w-full items-center gap-2 rounded-md border bg-muted/40 px-2 py-1"
            >
              {attachment.kind === CHAT_INPUT_ATTACHMENT_KINDS.image ? (
                <LuImage className="size-4 shrink-0" />
              ) : (
                <LuFileText className="size-4 shrink-0" />
              )}
              <span className="truncate text-xs">{attachment.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6 shrink-0"
                aria-label={`Remove ${attachment.name}`}
                disabled={isDisabled}
                onClick={() => onAttachmentsChange?.(attachments.filter((candidate) => candidate.id !== attachment.id))}
              >
                <LuX className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <EditorContent editor={editor} />
      <div className="flex items-center border-t border-input px-1 py-1">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={CHAT_INPUT_ATTACHMENT_ACCEPT}
          className="sr-only"
          aria-label="Choose files to attach"
          disabled={isDisabled}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            void createChatInputAttachments(files, attachments).then((result) => {
              if (result.attachments.length > 0) onAttachmentsChange?.([...attachments, ...result.attachments]);
              setAttachmentError(result.errors[0] ?? null);
            });
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isDisabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <LuPaperclip className="size-4" />
          Attach files
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">Images and text files</span>
      </div>
      {attachmentError ? (
        <p role="alert" className="border-t border-input px-2 py-1.5 text-xs text-destructive">
          {attachmentError}
        </p>
      ) : null}
    </div>
  );
}
