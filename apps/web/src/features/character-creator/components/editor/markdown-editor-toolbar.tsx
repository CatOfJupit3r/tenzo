import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import type { IconType } from 'react-icons';
import {
  LuBold,
  LuBraces,
  LuCode,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuItalic,
  LuList,
  LuListOrdered,
  LuRedo2,
  LuStrikethrough,
  LuTextQuote,
  LuUndo2,
} from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Separator } from '@~/components/ui/separator';
import { Toggle } from '@~/components/ui/toggle';

export interface iMarkdownEditorToolbarProps {
  editor: Editor | null;
  isDisabled?: boolean;
}

interface iToolbarToggleProps {
  label: string;
  icon: IconType;
  isActive: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

function ToolbarToggle({ label, icon: Icon, isActive, isDisabled, onToggle }: iToolbarToggleProps) {
  return (
    <Toggle
      aria-label={label}
      size="sm"
      className="size-8 min-w-8 p-0"
      pressed={isActive}
      disabled={isDisabled}
      onPressedChange={onToggle}
    >
      <Icon className="size-4" />
    </Toggle>
  );
}

export function MarkdownEditorToolbar({ editor, isDisabled = false }: iMarkdownEditorToolbarProps) {
  const toolbarState = useEditorState({
    editor,
    selector: (context) => {
      if (!context.editor) {
        return null;
      }
      return {
        isBoldActive: context.editor.isActive('bold'),
        isItalicActive: context.editor.isActive('italic'),
        isStrikeActive: context.editor.isActive('strike'),
        isHeading1Active: context.editor.isActive('heading', { level: 1 }),
        isHeading2Active: context.editor.isActive('heading', { level: 2 }),
        isHeading3Active: context.editor.isActive('heading', { level: 3 }),
        isBulletListActive: context.editor.isActive('bulletList'),
        isOrderedListActive: context.editor.isActive('orderedList'),
        isBlockquoteActive: context.editor.isActive('blockquote'),
        isCodeActive: context.editor.isActive('code'),
        isCodeBlockActive: context.editor.isActive('codeBlock'),
        canUndo: context.editor.can().undo(),
        canRedo: context.editor.can().redo(),
      };
    },
  });

  if (!editor || !toolbarState) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1 py-0.5">
      <ToolbarToggle
        label="Bold"
        icon={LuBold}
        isActive={toolbarState.isBoldActive}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarToggle
        label="Italic"
        icon={LuItalic}
        isActive={toolbarState.isItalicActive}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarToggle
        label="Strikethrough"
        icon={LuStrikethrough}
        isActive={toolbarState.isStrikeActive}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleStrike().run()}
      />
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <ToolbarToggle
        label="Heading 1"
        icon={LuHeading1}
        isActive={toolbarState.isHeading1Active}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarToggle
        label="Heading 2"
        icon={LuHeading2}
        isActive={toolbarState.isHeading2Active}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarToggle
        label="Heading 3"
        icon={LuHeading3}
        isActive={toolbarState.isHeading3Active}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <ToolbarToggle
        label="Bullet list"
        icon={LuList}
        isActive={toolbarState.isBulletListActive}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarToggle
        label="Ordered list"
        icon={LuListOrdered}
        isActive={toolbarState.isOrderedListActive}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarToggle
        label="Blockquote"
        icon={LuTextQuote}
        isActive={toolbarState.isBlockquoteActive}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarToggle
        label="Inline code"
        icon={LuCode}
        isActive={toolbarState.isCodeActive}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolbarToggle
        label="Code block"
        icon={LuBraces}
        isActive={toolbarState.isCodeBlockActive}
        isDisabled={isDisabled}
        onToggle={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Undo"
        disabled={isDisabled || !toolbarState.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <LuUndo2 className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Redo"
        disabled={isDisabled || !toolbarState.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <LuRedo2 className="size-4" />
      </Button>
    </div>
  );
}
