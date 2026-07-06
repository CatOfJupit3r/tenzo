import { useCallback, useEffect, useMemo, useState } from 'react';

import { toastError, toastSuccess } from '@~/components/toastifications';

import { characterLibraryCollection } from '../collections/character-library.collection';
import type { iCharacterCreatorActions } from '../context/character-creator-context/character-creator-actions-context.constants';
import { exportCharacterCardJson, exportCharacterCardPng, importCharacterCardFile } from '../lib/card-files';
import type { CharacterTextFieldKey } from '../lib/card-schema';
import { CHARACTER_LIBRARY_SOURCES } from '../lib/character-library';
import {
  createStoredExampleCharacter,
  getExampleCharacterDisplayName,
  MAX_EXAMPLE_CHARACTER_COUNT,
  toPromptExampleCharacter,
} from '../lib/example-characters';
import { REQUEST_MODES } from '../lib/generation-config';
import { deleteCharacterAssetBlob, readCharacterAssetBlob, writeCharacterAssetBlob } from '../lib/image-store';
import { invalidatePortraitAsset } from '../lib/portrait-asset-cache';
import { renderPortraitThumbnailDataUrl } from '../lib/portrait-focal-point';
import { ExampleContextService } from '../lib/prompt/example-context-service';
import { GENERATION_MODES } from '../lib/prompt/generation-contracts';
import type { GenerationMode, iFieldGenerationTarget } from '../lib/prompt/generation-contracts';
import { useCharacterPortrait } from './use-character-portrait';
import { useCharacterSession } from './use-character-session';
import { useGeneration } from './use-generation';

const exampleContextService = new ExampleContextService();

export interface iFieldGenerationState {
  shouldUseGeneralCharacterIdea: boolean;
  instructionValue: string;
  errorMessage: string | null | undefined;
  isGenerating: boolean;
  hasRewriteBackup: boolean;
  isRewriteReviewPending: boolean;
  rewriteBackupValue: string | null;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function removeRewriteBackup(backups: Record<string, string>, fieldKey: string) {
  const { [fieldKey]: _removedBackup, ...remainingBackups } = backups;
  return remainingBackups;
}

function removePendingReviewKey(pendingKeys: Record<string, boolean>, fieldKey: string) {
  return Object.fromEntries(Object.entries(pendingKeys).filter(([key]) => key !== fieldKey));
}

function createStandardFieldTarget(key: CharacterTextFieldKey, label: string, value: string): iFieldGenerationTarget {
  return {
    key: `field:${key}`,
    label,
    value,
    kind: 'field',
  };
}

export function useCharacterCreatorPage() {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [rewriteBackups, setRewriteBackups] = useState<Record<string, string>>({});
  const [pendingRewriteReviewKeys, setPendingRewriteReviewKeys] = useState<Record<string, boolean>>({});

  const {
    isCharacterLibraryReady,
    characterLibrary,
    activeCharacterId,
    card,
    portraitReference,
    updateField,
    updateTags,
    addGreeting,
    updateGreeting,
    removeGreeting,
    reorderGreetings,
    addCustomField,
    updateCustomField,
    removeCustomField,
    exampleCharacters,
    addExampleCharacters,
    updateExampleCharacterIncludedFields,
    removeExampleCharacter,
    createCharacter,
    selectCharacter,
    duplicateCharacter,
    removeCharacter,
  } = useCharacterSession();

  const {
    generationSettings,
    apiKey,
    updateApiKey,
    updateGenerationSettings,
    getGeneralCharacterIdea,
    updateGeneralCharacterIdea,
    getFieldInstruction,
    updateFieldInstruction,
    shouldUseGeneralCharacterIdea,
    updateFieldShouldUseGeneralCharacterIdea,
    removeCustomFieldInstruction,
    removeAlternateGreetingInstruction,
    reorderAlternateGreetingInstructions,
    connectionHealth,
    generateField,
    cancelGeneration,
    getFieldRuntime,
    probeConnection,
  } = useGeneration();

  const {
    portraitBlob,
    portraitDimensions,
    portraitObjectUrl,
    isHydratingPortrait,
    portraitCropRect,
    setPortrait,
    updatePortraitCropRect,
    clearPortrait,
  } = useCharacterPortrait();

  useEffect(() => {
    // Backups belong to the character they were captured from; drop them on switch.
    setRewriteBackups({});
    setPendingRewriteReviewKeys({});
  }, [activeCharacterId]);

  const { data } = card;
  const generalCharacterIdea = getGeneralCharacterIdea();
  const selectedRequestModeLabel =
    generationSettings.requestMode === REQUEST_MODES.proxy ? 'Server proxy' : 'Browser request';
  const maxExampleContextCharacters = exampleContextService.getCharacterBudget(
    generationSettings.contextSize,
    generationSettings.maxTokens,
  );

  const promptExampleCharacters = useMemo(
    () => exampleCharacters.map((exampleCharacter) => toPromptExampleCharacter(exampleCharacter)),
    [exampleCharacters],
  );

  const exampleContextSummary = useMemo(
    () =>
      exampleContextService.buildSummary({
        exampleCharacters: promptExampleCharacters,
        maxCharacters: maxExampleContextCharacters,
      }),
    [maxExampleContextCharacters, promptExampleCharacters],
  );

  const openImportDialog = useCallback(() => setIsImportDialogOpen(true), []);
  const openExportDialog = useCallback(() => setIsExportDialogOpen(true), []);

  const getGenerationState = useCallback(
    (fieldKey: string): iFieldGenerationState => {
      const runtime = getFieldRuntime(fieldKey);

      return {
        shouldUseGeneralCharacterIdea: shouldUseGeneralCharacterIdea(fieldKey),
        instructionValue: getFieldInstruction(fieldKey),
        errorMessage: runtime.errorMessage,
        isGenerating: runtime.isGenerating,
        hasRewriteBackup: rewriteBackups[fieldKey] !== undefined,
        isRewriteReviewPending: Boolean(pendingRewriteReviewKeys[fieldKey]) && rewriteBackups[fieldKey] !== undefined,
        rewriteBackupValue: rewriteBackups[fieldKey] ?? null,
      };
    },
    [getFieldInstruction, getFieldRuntime, pendingRewriteReviewKeys, rewriteBackups, shouldUseGeneralCharacterIdea],
  );

  const getStandardFieldGenerationState = useCallback(
    (key: CharacterTextFieldKey) => getGenerationState(`field:${key}`),
    [getGenerationState],
  );

  const runGeneration = useCallback(
    async (
      target: iFieldGenerationTarget,
      onValueChange: (value: string) => unknown,
      mode: GenerationMode = GENERATION_MODES.generate,
    ) => {
      setRewriteBackups((prev) => {
        if (mode === GENERATION_MODES.rewrite) {
          return { ...prev, [target.key]: target.value };
        }

        if (mode === GENERATION_MODES.continue) {
          return prev;
        }

        return removeRewriteBackup(prev, target.key);
      });
      // Starting any generation implicitly settles a pending review for the field.
      setPendingRewriteReviewKeys((prev) => removePendingReviewKey(prev, target.key));

      try {
        await generateField({
          card,
          target,
          onValueChange,
          mode,
          exampleCharacters: promptExampleCharacters,
          maxExampleContextCharacters,
        });

        if (mode === GENERATION_MODES.rewrite) {
          setPendingRewriteReviewKeys((prev) => ({ ...prev, [target.key]: true }));
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        const message = error instanceof Error ? error.message : 'The model request failed.';
        toastError('Generation failed', message);
      }
    },
    [card, generateField, maxExampleContextCharacters, promptExampleCharacters],
  );

  const revertFieldRewrite = useCallback(
    (fieldKey: string, onValueChange: (value: string) => unknown) => {
      const backupValue = rewriteBackups[fieldKey];

      if (backupValue === undefined) {
        return;
      }

      onValueChange(backupValue);
      setRewriteBackups((prev) => removeRewriteBackup(prev, fieldKey));
      setPendingRewriteReviewKeys((prev) => removePendingReviewKey(prev, fieldKey));
    },
    [rewriteBackups],
  );

  const resolveFieldRewriteReview = useCallback(
    (fieldKey: string, mergedValue: string, onValueChange: (value: string) => unknown) => {
      onValueChange(mergedValue);
      setRewriteBackups((prev) => removeRewriteBackup(prev, fieldKey));
      setPendingRewriteReviewKeys((prev) => removePendingReviewKey(prev, fieldKey));
    },
    [],
  );

  const acceptFieldRewrite = useCallback((fieldKey: string) => {
    setRewriteBackups((prev) => removeRewriteBackup(prev, fieldKey));
    setPendingRewriteReviewKeys((prev) => removePendingReviewKey(prev, fieldKey));
  }, []);

  const generateStandardField = useCallback(
    async (key: CharacterTextFieldKey, label: string, mode: GenerationMode = GENERATION_MODES.generate) => {
      await runGeneration(createStandardFieldTarget(key, label, data[key]), (value) => updateField(key, value), mode);
    },
    [data, runGeneration, updateField],
  );

  const cancelStandardFieldGeneration = useCallback(
    (key: CharacterTextFieldKey) => cancelGeneration(`field:${key}`),
    [cancelGeneration],
  );

  const revertStandardFieldRewrite = useCallback(
    (key: CharacterTextFieldKey) => revertFieldRewrite(`field:${key}`, (value) => updateField(key, value)),
    [revertFieldRewrite, updateField],
  );

  const resolveStandardFieldRewriteReview = useCallback(
    (key: CharacterTextFieldKey, mergedValue: string) =>
      resolveFieldRewriteReview(`field:${key}`, mergedValue, (value) => updateField(key, value)),
    [resolveFieldRewriteReview, updateField],
  );

  const acceptStandardFieldRewrite = useCallback(
    (key: CharacterTextFieldKey) => acceptFieldRewrite(`field:${key}`),
    [acceptFieldRewrite],
  );

  const updateStandardFieldShouldUseGeneralCharacterIdea = useCallback(
    (key: CharacterTextFieldKey, value: boolean) => updateFieldShouldUseGeneralCharacterIdea(`field:${key}`, value),
    [updateFieldShouldUseGeneralCharacterIdea],
  );

  const updateStandardFieldInstruction = useCallback(
    (key: CharacterTextFieldKey, value: string) => updateFieldInstruction(`field:${key}`, value),
    [updateFieldInstruction],
  );

  const handleHealthCheck = useCallback(async () => {
    try {
      const result = await probeConnection();
      const detailParts = [
        result.currentModel ?? result.models[0] ?? null,
        result.contextSize ? `${result.contextSize} context` : null,
      ].filter((value): value is string => Boolean(value));

      toastSuccess(
        'Endpoint checked',
        detailParts.length > 0 ? detailParts.join(' | ') : (result.providerName ?? 'Provider metadata inferred.'),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Health check failed.';
      toastError('Health check failed', message);
    }
  }, [probeConnection]);

  const handlePortraitSelect = useCallback(
    async (file: File) => {
      await setPortrait(file, file.name);
      toastSuccess('Portrait updated', file.name);
    },
    [setPortrait],
  );

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const importedCardFile = await importCharacterCardFile(file);
        const portrait =
          importedCardFile.portraitBlob === null
            ? null
            : {
                assetId: crypto.randomUUID(),
                fileName: importedCardFile.fileName,
                mimeType: importedCardFile.portraitBlob.type || 'application/octet-stream',
                cropRect: null,
                thumbnailDataUrl: await renderPortraitThumbnailDataUrl(importedCardFile.portraitBlob, null),
              };

        if (portrait && importedCardFile.portraitBlob) {
          await writeCharacterAssetBlob(portrait.assetId, importedCardFile.portraitBlob);
        }

        createCharacter({
          card: importedCardFile.card,
          portrait,
          source:
            importedCardFile.sourceKind === 'png' ? CHARACTER_LIBRARY_SOURCES.png : CHARACTER_LIBRARY_SOURCES.json,
        });

        toastSuccess('Character imported', importedCardFile.fileName);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The selected file could not be imported.';
        toastError('Import failed', message);
        throw error;
      }
    },
    [createCharacter],
  );

  const handleCreateCharacter = useCallback(() => {
    createCharacter();
    toastSuccess('Character created', 'A fresh entry is ready in your library.');
  }, [createCharacter]);

  const handleSelectCharacter = useCallback(
    (id: string) => {
      selectCharacter(id);
    },
    [selectCharacter],
  );

  const handleDuplicateCharacter = useCallback(
    async (id: string) => {
      const character = characterLibraryCollection.get(id);

      if (!character) {
        toastError('Duplicate failed', 'The selected character could not be found.');
        return;
      }

      let nextPortrait = character.portrait;

      if (character.portrait) {
        const duplicatedPortraitBlob = await readCharacterAssetBlob(character.portrait.assetId);

        if (duplicatedPortraitBlob) {
          const assetId = crypto.randomUUID();
          await writeCharacterAssetBlob(assetId, duplicatedPortraitBlob);
          nextPortrait = {
            ...character.portrait,
            assetId,
            cropRect: character.portrait.cropRect ? { ...character.portrait.cropRect } : null,
          };
        } else {
          nextPortrait = null;
        }
      }

      const duplicatedCharacterId = duplicateCharacter({
        id,
        portrait: nextPortrait,
      });

      if (!duplicatedCharacterId) {
        toastError('Duplicate failed', 'The selected character could not be copied.');
        return;
      }

      toastSuccess('Character duplicated', 'The copied entry is ready in your library.');
    },
    [duplicateCharacter],
  );

  const handleRemoveCharacter = useCallback(
    async (id: string) => {
      const character = characterLibraryCollection.get(id);

      if (character?.portrait) {
        await deleteCharacterAssetBlob(character.portrait.assetId);
        invalidatePortraitAsset(character.portrait.assetId);
      }

      removeCharacter(id);
      toastSuccess('Character removed', 'The library entry has been cleared from this browser.');
    },
    [removeCharacter],
  );

  const handleRemoveGreeting = useCallback(
    (index: number) => {
      removeGreeting(index);
      removeAlternateGreetingInstruction(index);
    },
    [removeAlternateGreetingInstruction, removeGreeting],
  );

  const handleReorderGreetings = useCallback(
    (fromIndex: number, toIndex: number) => {
      reorderGreetings(fromIndex, toIndex);
      reorderAlternateGreetingInstructions(fromIndex, toIndex);
    },
    [reorderAlternateGreetingInstructions, reorderGreetings],
  );

  const updateAlternateGreetingShouldUseGeneralCharacterIdea = useCallback(
    (index: number, value: boolean) => updateFieldShouldUseGeneralCharacterIdea(`alternate_greetings:${index}`, value),
    [updateFieldShouldUseGeneralCharacterIdea],
  );

  const updateAlternateGreetingInstruction = useCallback(
    (index: number, value: string) => updateFieldInstruction(`alternate_greetings:${index}`, value),
    [updateFieldInstruction],
  );

  const generateAlternateGreeting = useCallback(
    async (index: number, mode: GenerationMode = GENERATION_MODES.generate) => {
      await runGeneration(
        {
          key: `alternate_greetings:${index}`,
          label: `Alternate Greeting ${index + 1}`,
          value: data.alternate_greetings[index] ?? '',
          kind: 'alternate-greeting',
        },
        (value) => updateGreeting(index, value),
        mode,
      );
    },
    [data.alternate_greetings, runGeneration, updateGreeting],
  );

  const cancelAlternateGreetingGeneration = useCallback(
    (index: number) => cancelGeneration(`alternate_greetings:${index}`),
    [cancelGeneration],
  );

  const revertAlternateGreetingRewrite = useCallback(
    (index: number) => revertFieldRewrite(`alternate_greetings:${index}`, (value) => updateGreeting(index, value)),
    [revertFieldRewrite, updateGreeting],
  );

  const resolveAlternateGreetingRewriteReview = useCallback(
    (index: number, mergedValue: string) =>
      resolveFieldRewriteReview(`alternate_greetings:${index}`, mergedValue, (value) => updateGreeting(index, value)),
    [resolveFieldRewriteReview, updateGreeting],
  );

  const acceptAlternateGreetingRewrite = useCallback(
    (index: number) => acceptFieldRewrite(`alternate_greetings:${index}`),
    [acceptFieldRewrite],
  );

  const handleRemoveCustomField = useCallback(
    (id: string) => {
      removeCustomField(id);
      removeCustomFieldInstruction(id);
    },
    [removeCustomField, removeCustomFieldInstruction],
  );

  const updateCustomFieldShouldUseGeneralCharacterIdea = useCallback(
    (id: string, value: boolean) => updateFieldShouldUseGeneralCharacterIdea(`custom:${id}`, value),
    [updateFieldShouldUseGeneralCharacterIdea],
  );

  const updateCustomFieldInstruction = useCallback(
    (id: string, value: string) => updateFieldInstruction(`custom:${id}`, value),
    [updateFieldInstruction],
  );

  const generateCustomField = useCallback(
    async (id: string, mode: GenerationMode = GENERATION_MODES.generate) => {
      const customField = data.extensions.custom_fields.find((field) => field.id === id);

      if (!customField) {
        return;
      }

      await runGeneration(
        {
          key: `custom:${id}`,
          label: customField.label.trim() ?? 'Custom Field',
          value: customField.value,
          kind: 'custom-field',
        },
        (value) => updateCustomField(id, { value }),
        mode,
      );
    },
    [data.extensions.custom_fields, runGeneration, updateCustomField],
  );

  const cancelCustomFieldGeneration = useCallback((id: string) => cancelGeneration(`custom:${id}`), [cancelGeneration]);

  const revertCustomFieldRewrite = useCallback(
    (id: string) => revertFieldRewrite(`custom:${id}`, (value) => updateCustomField(id, { value })),
    [revertFieldRewrite, updateCustomField],
  );

  const resolveCustomFieldRewriteReview = useCallback(
    (id: string, mergedValue: string) =>
      resolveFieldRewriteReview(`custom:${id}`, mergedValue, (value) => updateCustomField(id, { value })),
    [resolveFieldRewriteReview, updateCustomField],
  );

  const acceptCustomFieldRewrite = useCallback(
    (id: string) => acceptFieldRewrite(`custom:${id}`),
    [acceptFieldRewrite],
  );

  const handleImportExampleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      const availableSlots = MAX_EXAMPLE_CHARACTER_COUNT - exampleCharacters.length;

      if (availableSlots <= 0) {
        toastError('Example limit reached', 'Remove an example before importing another.');
        return;
      }

      const importedExamples: ReturnType<typeof createStoredExampleCharacter>[] = [];
      const failedImports: string[] = [];

      for (const file of files.slice(0, availableSlots)) {
        try {
          const importedCardFile = await importCharacterCardFile(file);
          importedExamples.push(createStoredExampleCharacter(importedCardFile));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Import failed.';
          failedImports.push(`${file.name}: ${message}`);
        }
      }

      if (importedExamples.length > 0) {
        addExampleCharacters(importedExamples);
        const firstImportedName = getExampleCharacterDisplayName(importedExamples[0]);

        toastSuccess(
          'Reference characters imported',
          importedExamples.length === 1
            ? `${firstImportedName} is ready for generation context.`
            : `${importedExamples.length} examples are ready for generation context.`,
        );
      }

      if (files.length > availableSlots) {
        toastError(
          'Example limit reached',
          `Only ${availableSlots} of ${files.length} selected files were imported. The session supports up to ${MAX_EXAMPLE_CHARACTER_COUNT} examples.`,
        );
      }

      if (failedImports.length > 0) {
        toastError('Some examples were skipped', failedImports.join(' | '));
      }
    },
    [addExampleCharacters, exampleCharacters.length],
  );

  const greetingGenerationStates = useMemo(
    () => data.alternate_greetings.map((_, index) => getGenerationState(`alternate_greetings:${index}`)),
    [data.alternate_greetings, getGenerationState],
  );

  const customFieldGenerationStates = useMemo(
    () =>
      Object.fromEntries(
        data.extensions.custom_fields.map((field) => [field.id, getGenerationState(`custom:${field.id}`)]),
      ) as Record<string, iFieldGenerationState>,
    [data.extensions.custom_fields, getGenerationState],
  );

  const handleExportJson = useCallback(async () => {
    try {
      await exportCharacterCardJson(card);
      toastSuccess('JSON exported', 'The hybrid V1+V2 card file has been downloaded.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The character card could not be exported as JSON.';
      toastError('JSON export failed', message);
      throw error;
    }
  }, [card]);

  const handleExportPng = useCallback(async () => {
    if (!portraitBlob) {
      toastError('PNG export failed', 'Add a portrait image before exporting PNG.');
      return;
    }

    try {
      await exportCharacterCardPng(card, portraitBlob, portraitCropRect);
      toastSuccess('PNG exported', 'The portrait now contains an updated `chara` metadata chunk.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The character card could not be exported as PNG.';
      toastError('PNG export failed', message);
      throw error;
    }
  }, [card, portraitBlob, portraitCropRect]);

  const actions = useMemo<iCharacterCreatorActions>(
    () => ({
      openImportDialog,
      openExportDialog,
      handleCreateCharacter,
      handleSelectCharacter,
      handleDuplicateCharacter,
      handleRemoveCharacter,
    }),
    [
      handleCreateCharacter,
      handleDuplicateCharacter,
      handleRemoveCharacter,
      handleSelectCharacter,
      openExportDialog,
      openImportDialog,
    ],
  );

  return {
    actions,
    isCharacterLibraryReady,
    characterLibrary,
    activeCharacterId,
    card,
    data,
    updateField,
    updateTags,
    addGreeting,
    updateGreeting,
    handleRemoveGreeting,
    handleReorderGreetings,
    addCustomField,
    updateCustomField,
    handleRemoveCustomField,

    exampleCharacters,
    exampleContextSummary,
    handleImportExampleFiles,
    updateExampleCharacterIncludedFields,
    removeExampleCharacter,

    generationSettings,
    apiKey,
    updateApiKey,
    updateGenerationSettings,
    connectionHealth,
    handleHealthCheck,
    generalCharacterIdea,
    updateGeneralCharacterIdea,
    selectedRequestModeLabel,
    maxExampleContextCharacters,

    getStandardFieldGenerationState,
    generateStandardField,
    cancelStandardFieldGeneration,
    revertStandardFieldRewrite,
    resolveStandardFieldRewriteReview,
    acceptStandardFieldRewrite,
    updateStandardFieldShouldUseGeneralCharacterIdea,
    updateStandardFieldInstruction,

    greetingGenerationStates,
    updateAlternateGreetingShouldUseGeneralCharacterIdea,
    updateAlternateGreetingInstruction,
    generateAlternateGreeting,
    cancelAlternateGreetingGeneration,
    revertAlternateGreetingRewrite,
    resolveAlternateGreetingRewriteReview,
    acceptAlternateGreetingRewrite,

    customFieldGenerationStates,
    updateCustomFieldShouldUseGeneralCharacterIdea,
    updateCustomFieldInstruction,
    generateCustomField,
    cancelCustomFieldGeneration,
    revertCustomFieldRewrite,
    resolveCustomFieldRewriteReview,
    acceptCustomFieldRewrite,

    portraitReference,
    portraitBlob,
    portraitDimensions,
    portraitObjectUrl,
    isHydratingPortrait,
    portraitCropRect,
    handlePortraitSelect,
    updatePortraitCropRect,
    clearPortrait,

    isImportDialogOpen,
    setIsImportDialogOpen,
    openImportDialog,
    isExportDialogOpen,
    setIsExportDialogOpen,
    openExportDialog,
    handleImport,
    handleExportJson,
    handleExportPng,
    handleCreateCharacter,
    handleSelectCharacter,
    handleDuplicateCharacter,
    handleRemoveCharacter,
  };
}
