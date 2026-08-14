import type { Editor, Extensions, JSONContent } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { UndoRedo } from '@tiptap/extensions';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { buildBaseEditorExtensions } from './base-editor-extensions';
import type { iEditorSerializer } from './editor-contracts';
import { MES_EXAMPLE_LINE_KINDS, classifyMesExampleLine, getSpeakerPrefixLength } from './mes-example-format';

export function parseMesExampleToDoc(raw: string): JSONContent {
  return {
    type: 'doc',
    content: raw.split('\n').map((line) => ({
      type: 'paragraph',
      ...(line.length > 0 ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  };
}

export function serializeMesExampleDoc(doc: ProseMirrorNode): string {
  const lines: string[] = [];
  doc.forEach((child) => {
    lines.push(child.textContent);
  });
  return lines.join('\n');
}

export const MES_EXAMPLE_EDITOR_SERIALIZER = {
  serialize: (editor: Editor) => serializeMesExampleDoc(editor.state.doc),
} satisfies iEditorSerializer;

const mesExampleDecorationsPluginKey = new PluginKey<DecorationSet>('mesExampleDecorations');

function buildMesExampleDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.forEach((child, offset) => {
    const line = child.textContent;
    const kind = classifyMesExampleLine(line);
    if (kind === MES_EXAMPLE_LINE_KINDS.start) {
      decorations.push(Decoration.node(offset, offset + child.nodeSize, { class: 'mes-example-start-line' }));
      return;
    }
    if (kind === MES_EXAMPLE_LINE_KINDS.charTurn || kind === MES_EXAMPLE_LINE_KINDS.userTurn) {
      const prefixLength = getSpeakerPrefixLength(line);
      const speakerClass =
        kind === MES_EXAMPLE_LINE_KINDS.charTurn ? 'mes-example-speaker-char' : 'mes-example-speaker-user';
      decorations.push(Decoration.inline(offset + 1, offset + 1 + prefixLength, { class: speakerClass }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

const MesExampleDecorations = Extension.create({
  name: 'mesExampleDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: mesExampleDecorationsPluginKey,
        state: {
          init: (_, state) => buildMesExampleDecorations(state.doc),
          apply: (tr, previous) => (tr.docChanged ? buildMesExampleDecorations(tr.doc) : previous),
        },
        props: {
          decorations(state) {
            return mesExampleDecorationsPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});

export interface iBuildMesExampleExtensionsOptions {
  placeholder?: string;
}

export function buildMesExampleExtensions(options: iBuildMesExampleExtensionsOptions = {}): Extensions {
  return [
    Document,
    Paragraph,
    Text,
    UndoRedo,
    MesExampleDecorations,
    ...buildBaseEditorExtensions({ placeholder: options.placeholder }),
  ];
}
