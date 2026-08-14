import type { Extensions } from '@tiptap/core';
import type { UseEditorOptions } from '@tiptap/react';
import { useEditor } from '@tiptap/react';
import { useMemo } from 'react';

import type { iSyncedEditorContent, iUseSyncedFieldEditorOptions } from '../../hooks/use-synced-field-editor';
import { useSyncedFieldEditor } from '../../hooks/use-synced-field-editor';

export type iSyncedEditorHookOptions = Omit<
  iUseSyncedFieldEditorOptions,
  'extensions' | 'serializeValue' | 'toEditorContent'
>;

interface iSyncedEditorFactoryOptions<TOptions extends iSyncedEditorHookOptions> {
  buildExtensions: (options: TOptions) => Extensions;
  getExtensionDependencies: (options: TOptions) => readonly unknown[];
  serializeValue: iUseSyncedFieldEditorOptions['serializeValue'];
  toEditorContent: (value: string) => iSyncedEditorContent;
}

interface iEditorHookFactoryOptions<TOptions> {
  buildExtensions: (options: TOptions) => Extensions;
  getExtensionDependencies: (options: TOptions) => readonly unknown[];
  buildEditorOptions: (options: TOptions) => Omit<UseEditorOptions, 'extensions'>;
}

export function createEditorHook<TOptions>({
  buildExtensions,
  getExtensionDependencies,
  buildEditorOptions,
}: iEditorHookFactoryOptions<TOptions>) {
  return function useCreatedEditor(options: TOptions) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const extensions = useMemo(() => buildExtensions(options), getExtensionDependencies(options));
    return useEditor({ ...buildEditorOptions(options), extensions });
  };
}

export function createSyncedEditorHook<TOptions extends iSyncedEditorHookOptions>({
  buildExtensions,
  getExtensionDependencies,
  serializeValue,
  toEditorContent,
}: iSyncedEditorFactoryOptions<TOptions>) {
  return function useCreatedSyncedEditor(options: TOptions) {
    // The factory owns extension memoization so every synced editor wrapper follows the same lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const extensions = useMemo(() => buildExtensions(options), getExtensionDependencies(options));
    return useSyncedFieldEditor({ ...options, extensions, serializeValue, toEditorContent });
  };
}
