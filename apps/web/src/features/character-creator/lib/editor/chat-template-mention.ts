import { mergeAttributes } from '@tiptap/core';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { createElement } from 'react';
import { LuFileText } from 'react-icons/lu';
import { z } from 'zod';

import { STORED_FIELD_TEMPLATE_SCHEMA } from '../cards/field-templates';
import type { iFieldTemplateViewModel } from '../cards/field-templates';

type iChatTemplateSuggestionProps = SuggestionProps<iFieldTemplateViewModel, iFieldTemplateViewModel>;
const CHAT_TEMPLATE_VIEW_MODEL_SCHEMA = STORED_FIELD_TEMPLATE_SCHEMA.extend({ isBuiltIn: z.boolean() });

export interface iBuildChatTemplateMentionOptions {
  templates: iFieldTemplateViewModel[];
  preferredFieldKeys?: readonly string[];
}

export interface iChatTemplateMentionReference {
  id: string;
  label: string;
}

function sortTemplates(templates: iFieldTemplateViewModel[], preferredFieldKeys: readonly string[]) {
  return [...templates].sort((leftTemplate, rightTemplate) => {
    const isLeftPreferred = leftTemplate.fieldKeys.some((fieldKey) => preferredFieldKeys.includes(fieldKey));
    const isRightPreferred = rightTemplate.fieldKeys.some((fieldKey) => preferredFieldKeys.includes(fieldKey));
    return Number(isRightPreferred) - Number(isLeftPreferred) || leftTemplate.name.localeCompare(rightTemplate.name);
  });
}

function createSuggestionRenderer() {
  let renderer: ReactRenderer | null = null;
  let latestProps: iChatTemplateSuggestionProps | null = null;
  let selectedIndex = 0;

  const updatePosition = () => {
    const clientRect = latestProps?.clientRect?.();
    if (!renderer || !clientRect) {
      return;
    }

    renderer.element.style.position = 'fixed';
    renderer.element.style.left = `${clientRect.left}px`;
    renderer.element.style.top = `${clientRect.bottom + 6}px`;
    renderer.element.style.zIndex = '100';
  };

  return {
    onStart: (props: iChatTemplateSuggestionProps) => {
      latestProps = props;
      selectedIndex = 0;
      renderer = new ReactRenderer(ChatTemplateSuggestionList, {
        props: { ...props, selectedIndex },
        editor: props.editor,
      });
      document.body.appendChild(renderer.element);
      updatePosition();
    },
    onUpdate: (props: iChatTemplateSuggestionProps) => {
      latestProps = props;
      selectedIndex = Math.min(selectedIndex, Math.max(0, props.items.length - 1));
      renderer?.updateProps({ ...props, selectedIndex });
      updatePosition();
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (!latestProps || latestProps.items.length === 0) {
        return false;
      }

      if (props.event.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % latestProps.items.length;
        renderer?.updateProps({ ...latestProps, selectedIndex });
        return true;
      }

      if (props.event.key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + latestProps.items.length) % latestProps.items.length;
        renderer?.updateProps({ ...latestProps, selectedIndex });
        return true;
      }

      if (props.event.key === 'Enter') {
        props.event.preventDefault();
        latestProps.command(latestProps.items[selectedIndex]);
        return true;
      }

      if (props.event.key === 'Escape') {
        renderer?.destroy();
        renderer = null;
        return true;
      }

      return false;
    },
    onExit: () => {
      renderer?.destroy();
      renderer = null;
      latestProps = null;
    },
  };
}

function ChatTemplateSuggestionList({
  items,
  selectedIndex,
  command,
}: {
  items: iFieldTemplateViewModel[];
  selectedIndex: number;
  command: (item: iFieldTemplateViewModel) => unknown;
}) {
  return createElement(
    'div',
    { className: 'min-w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md' },
    items.map((template, index) =>
      createElement(
        'button',
        {
          className: `block w-full rounded-sm px-2 py-1.5 text-left text-sm ${index === selectedIndex ? 'bg-accent' : ''}`,
          key: template.id,
          type: 'button',
          onMouseDown: (event: { preventDefault: () => unknown }) => {
            event.preventDefault();
            command(template);
          },
        },
        createElement(
          'span',
          { className: 'flex items-center gap-1.5' },
          createElement(LuFileText, { className: 'size-3.5 shrink-0' }),
          `${template.name} (${template.mode})`,
        ),
      ),
    ),
  );
}

export function buildChatTemplateMentionExtension({
  templates,
  preferredFieldKeys = [],
}: iBuildChatTemplateMentionOptions) {
  const sortedTemplates = sortTemplates(templates, preferredFieldKeys);

  return Mention.configure({
    HTMLAttributes: {
      class:
        'chat-template-mention inline-flex cursor-pointer rounded-sm bg-chart-4/20 px-1 font-mono text-[0.9em] text-chart-5',
      'data-mention-kind': 'template',
    },
    suggestion: {
      char: '/',
      items: ({ query }) =>
        sortedTemplates
          .filter((template) => template.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
          .slice(0, 8),
      command: ({ editor, range, props }) => {
        const template = CHAT_TEMPLATE_VIEW_MODEL_SCHEMA.parse(props);
        editor
          .chain()
          .focus()
          .insertContentAt(range, {
            type: 'mention',
            attrs: { id: template.id, label: template.name },
          })
          .run();
      },
      render: () => createSuggestionRenderer(),
    },
    renderText: ({ node }) => `/${node.attrs.label ?? ''}`,
    renderHTML: ({ options, node }) => [
      'span',
      mergeAttributes(options.HTMLAttributes, {
        'data-type': 'mention',
        title: `Template: ${node.attrs.label ?? 'Untitled template'}`,
      }),
      `▣ /${node.attrs.label ?? ''}`,
    ],
  });
}
