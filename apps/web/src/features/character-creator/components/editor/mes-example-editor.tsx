import { EditorContent } from '@tiptap/react';
import { LuPlus } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { cn } from '@~/lib/utils';

import { useMesExampleEditor } from '../../hooks/use-mes-example-editor';

export interface iMesExampleEditorProps {
  fieldId: string;
  value: string;
  rows?: number;
  placeholder?: string;
  isReadOnly?: boolean;
  isStreaming?: boolean;
  ariaDescribedBy?: string;
  onValueChange: (value: string) => void;
}

const EDITOR_LINE_HEIGHT_PX = 24;
const EDITOR_VERTICAL_PADDING_PX = 16;
const EDITOR_MAX_HEIGHT_PX = 480;

export function MesExampleEditor({
  fieldId,
  value,
  rows = 10,
  placeholder,
  isReadOnly = false,
  isStreaming = false,
  ariaDescribedBy,
  onValueChange,
}: iMesExampleEditorProps) {
  const { editor } = useMesExampleEditor({
    value,
    isReadOnly,
    isStreaming,
    placeholder,
    editorAttributes: {
      id: fieldId,
      role: 'textbox',
      'aria-multiline': 'true',
      ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
    },
    onValueChange,
  });

  const insertStartBlock = () => {
    if (!editor) {
      return;
    }
    editor
      .chain()
      .focus('end')
      .insertContent([
        { type: 'paragraph', content: [{ type: 'text', text: '<START>' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '{{user}}: ' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '{{char}}: ' }] },
      ])
      .run();
  };

  return (
    <div
      className={cn(
        'w-full rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30',
        isReadOnly && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-input px-2 py-0.5">
        <span className="text-xs text-muted-foreground">Dialogue blocks separated by &lt;START&gt; lines</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isReadOnly}
          onClick={insertStartBlock}
        >
          <LuPlus className="size-3.5" />
          Dialogue block
        </Button>
      </div>
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
