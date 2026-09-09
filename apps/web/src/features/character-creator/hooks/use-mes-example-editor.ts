import { EDITOR_CONTENT_TYPES } from '@~/features/character-creator/lib/editor/editor-enums';

import {
  buildMesExampleExtensions,
  MES_EXAMPLE_EDITOR_SERIALIZER,
  parseMesExampleToDoc,
} from '../lib/editor/mes-example-extensions';
import type { iSyncedEditorHookOptions, SyncedEditorOverrideProps } from '../lib/editor/synced-editor-hook';
import { createSyncedEditorHook } from '../lib/editor/synced-editor-hook';
import type { iSyncedEditorContent } from './use-synced-field-editor';

export interface iUseMesExampleEditorOptions
  extends Partial<SyncedEditorOverrideProps>, Omit<iSyncedEditorHookOptions, keyof SyncedEditorOverrideProps> {
  placeholder?: string;
}

function toMesExampleEditorContent(value: string): iSyncedEditorContent {
  return { content: parseMesExampleToDoc(value), contentType: EDITOR_CONTENT_TYPES.JSON };
}

interface iNormalizedMesExampleEditorOptions extends iUseMesExampleEditorOptions {
  isReadOnly: boolean;
  isStreaming: boolean;
  editorAttributes: Record<string, string>;
}

const useCreatedMesExampleEditor = createSyncedEditorHook<iNormalizedMesExampleEditorOptions>({
  buildExtensions: ({ placeholder }) => buildMesExampleExtensions({ placeholder }),
  getExtensionDependencies: ({ placeholder }) => [placeholder],
  serializeValue: MES_EXAMPLE_EDITOR_SERIALIZER.serialize,
  toEditorContent: toMesExampleEditorContent,
});

export function useMesExampleEditor(options: iUseMesExampleEditorOptions) {
  return useCreatedMesExampleEditor({
    ...options,
    isReadOnly: options.isReadOnly ?? false,
    isStreaming: options.isStreaming ?? false,
    editorAttributes: options.editorAttributes ?? {},
  });
}
