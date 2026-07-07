import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { findMacroRanges } from './macro-tokens';

export interface iMacroHighlightOptions {
  doesAllowOriginalMacro: boolean;
  doesHighlightTemplateSlots: boolean;
}

const macroHighlightPluginKey = new PluginKey<DecorationSet>('characterMacroHighlight');

function buildMacroDecorations(doc: ProseMirrorNode, options: iMacroHighlightOptions): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return true;
    }
    for (const range of findMacroRanges(node.text, options)) {
      decorations.push(
        Decoration.inline(pos + range.from, pos + range.to, {
          class: `macro-chip macro-chip-${range.kind}`,
        }),
      );
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
}

export const MacroHighlight = Extension.create<iMacroHighlightOptions>({
  name: 'macroHighlight',

  addOptions() {
    return {
      doesAllowOriginalMacro: false,
      doesHighlightTemplateSlots: false,
    };
  },

  addProseMirrorPlugins() {
    const { options } = this;
    return [
      new Plugin<DecorationSet>({
        key: macroHighlightPluginKey,
        state: {
          init: (_, state) => buildMacroDecorations(state.doc, options),
          apply: (tr, previous) => (tr.docChanged ? buildMacroDecorations(tr.doc, options) : previous),
        },
        props: {
          decorations(state) {
            return macroHighlightPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
