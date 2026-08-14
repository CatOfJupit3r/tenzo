import {
  buildMesExampleExtensions,
  MES_EXAMPLE_EDITOR_SERIALIZER,
  parseMesExampleToDoc,
} from '../lib/editor/mes-example-extensions';
import { createSyncedEditorHook } from '../lib/editor/synced-editor-hook';
import type { iSyncedEditorHookOptions } from '../lib/editor/synced-editor-hook';
import type { iSyncedEditorContent } from './use-synced-field-editor';

export interface iUseMesExampleEditorOptions
  extends
    Partial<Pick<iSyncedEditorHookOptions, 'isReadOnly' | 'isStreaming' | 'editorAttributes'>>,
    Omit<iSyncedEditorHookOptions, 'isReadOnly' | 'isStreaming' | 'editorAttributes'> {
  placeholder?: string;
}

function toMesExampleEditorContent(value: string): iSyncedEditorContent {
  return { content: parseMesExampleToDoc(value), contentType: 'json' };
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
