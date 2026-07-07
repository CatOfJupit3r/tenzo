import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { toastError, toastSuccess } from '@~/components/toastifications';
import { generateUuid } from '@~/utils/uuid';

import { characterGenerationSettingsAtom } from '../atoms/character-generation.atom';
import { exportSettingsAtom } from '../atoms/export-settings.atom';
import { characterLibraryCollection } from '../collections/character-library.collection';
import { exampleCharactersCollection } from '../collections/example-characters.collection';
import type { iCharacterCreatorActions } from '../context/character-creator-context/character-creator-actions-context.constants';
import type { iBackupPortraitAsset, iTenzoBackup } from '../lib/backup';
import {
  exportCharacterCardJson,
  exportCharacterCardPng,
  exportCharactersArchive,
  exportFullBackupArchive,
  importArchiveFile,
  importCharacterCardFile,
  isArchiveFile,
} from '../lib/card-files';
import type { iBulkExportCharacter, iImportedCharacterCardFile } from '../lib/card-files';
import type { CharacterTextFieldKey } from '../lib/card-schema';
import { CHARACTER_LIBRARY_SOURCES, createCharacterLibraryItem } from '../lib/character-library';
import type { iCharacterPortraitReference } from '../lib/character-library';
import {
  createStoredExampleCharacter,
  getExampleCharacterDisplayName,
  MAX_EXAMPLE_CHARACTER_COUNT,
  toPromptExampleCharacter,
} from '../lib/example-characters';
import type { iExportSettings } from '../lib/export-settings';
import { getTemplateFieldKeyForTargetKey, TEMPLATE_MODES } from '../lib/field-templates';
import { sanitizeCharacterGenerationConnectionSettings, REQUEST_MODES } from '../lib/generation-config';
import { deleteCharacterAssetBlob, readCharacterAssetBlob, writeCharacterAssetBlob } from '../lib/image-store';
import { invalidatePortraitAsset } from '../lib/portrait-asset-cache';
import { renderPortraitThumbnailDataUrl } from '../lib/portrait-focal-point';
import { ExampleContextService } from '../lib/prompt/example-context-service';
import { GENERATION_MODES } from '../lib/prompt/generation-contracts';
import type { GenerationMode, iFieldGenerationTarget, iPromptFieldTemplate } from '../lib/prompt/generation-contracts';
import { useCharacterPortrait } from './use-character-portrait';
import { useCharacterSession } from './use-character-session';
import { useFieldTemplates } from './use-field-templates';
import { useGeneration } from './use-generation';

const exampleContextService = new ExampleContextService();

async function createImportedPortraitReference(
  importedCardFile: iImportedCharacterCardFile,
): Promise<iCharacterPortraitReference | null> {
  if (!importedCardFile.portraitBlob) {
    return null;
  }

  const { cropRect } = importedCardFile.tenzoMetadata;
  const portrait: iCharacterPortraitReference = {
    assetId: generateUuid(),
    fileName: importedCardFile.fileName,
    mimeType: importedCardFile.portraitBlob.type || 'application/octet-stream',
    cropRect,
    thumbnailDataUrl: await renderPortraitThumbnailDataUrl(importedCardFile.portraitBlob, cropRect),
  };

  await writeCharacterAssetBlob(portrait.assetId, importedCardFile.portraitBlob);
  return portrait;
}

export interface iFieldGenerationState {
  shouldUseGeneralCharacterIdea: boolean;
  instructionValue: string;
  templateId: string | null;
  isStrictTemplateSelected: boolean;
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
  const [exportSettings, setExportSettings] = useAtom(exportSettingsAtom);
  const setStoredGenerationSettings = useSetAtom(characterGenerationSettingsAtom);
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
    replaceCard,
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
    getFieldTemplateId,
    updateFieldTemplateId,
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
    fieldTemplates,
    getFieldTemplateById,
    getTemplatesForField,
    addFieldTemplate,
    updateFieldTemplate,
    removeFieldTemplate,
    duplicateFieldTemplate,
  } = useFieldTemplates();

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

  const resolveFieldTemplate = useCallback(
    (fieldKey: string) => getFieldTemplateById(getFieldTemplateId(fieldKey)),
    [getFieldTemplateById, getFieldTemplateId],
  );

  const getGenerationState = useCallback(
    (fieldKey: string): iFieldGenerationState => {
      const runtime = getFieldRuntime(fieldKey);
      // Dangling ids (deleted templates) resolve to no selection.
      const selectedTemplate = resolveFieldTemplate(fieldKey);

      return {
        shouldUseGeneralCharacterIdea: shouldUseGeneralCharacterIdea(fieldKey),
        instructionValue: getFieldInstruction(fieldKey),
        templateId: selectedTemplate?.id ?? null,
        isStrictTemplateSelected: selectedTemplate?.mode === TEMPLATE_MODES.strict,
        errorMessage: runtime.errorMessage,
        isGenerating: runtime.isGenerating,
        hasRewriteBackup: rewriteBackups[fieldKey] !== undefined,
        isRewriteReviewPending: Boolean(pendingRewriteReviewKeys[fieldKey]) && rewriteBackups[fieldKey] !== undefined,
        rewriteBackupValue: rewriteBackups[fieldKey] ?? null,
      };
    },
    [
      getFieldInstruction,
      getFieldRuntime,
      pendingRewriteReviewKeys,
      resolveFieldTemplate,
      rewriteBackups,
      shouldUseGeneralCharacterIdea,
    ],
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

      const selectedTemplate = resolveFieldTemplate(target.key);
      const fieldTemplate: iPromptFieldTemplate | null = selectedTemplate
        ? { name: selectedTemplate.name, mode: selectedTemplate.mode, content: selectedTemplate.content }
        : null;

      try {
        await generateField({
          card,
          target,
          onValueChange,
          mode,
          fieldTemplate,
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
    [card, generateField, maxExampleContextCharacters, promptExampleCharacters, resolveFieldTemplate],
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

  const updateStandardFieldTemplateId = useCallback(
    (key: CharacterTextFieldKey, templateId: string | null) => updateFieldTemplateId(`field:${key}`, templateId),
    [updateFieldTemplateId],
  );

  const getTemplateOptionsForTargetKey = useCallback(
    (targetKey: string) => {
      const templateFieldKey = getTemplateFieldKeyForTargetKey(targetKey);
      return templateFieldKey ? getTemplatesForField(templateFieldKey) : [];
    },
    [getTemplatesForField],
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

  const importCardAsCharacter = useCallback(
    async (importedCardFile: iImportedCharacterCardFile) => {
      const portrait = await createImportedPortraitReference(importedCardFile);

      createCharacter({
        card: importedCardFile.card,
        portrait,
        promptSettings: importedCardFile.tenzoMetadata.promptSettings ?? undefined,
        source: importedCardFile.sourceKind === 'png' ? CHARACTER_LIBRARY_SOURCES.png : CHARACTER_LIBRARY_SOURCES.json,
      });
    },
    [createCharacter],
  );

  const restoreFullBackup = useCallback(
    async (backup: iTenzoBackup) => {
      await Promise.all(
        backup.assets.map(async (asset) =>
          writeCharacterAssetBlob(asset.assetId, new Blob([asset.bytes.slice()], { type: asset.mimeType })),
        ),
      );

      backup.characters.forEach((character) => {
        const restoredCharacter = characterLibraryCollection.has(character.id)
          ? createCharacterLibraryItem({ ...character, id: generateUuid() })
          : character;

        characterLibraryCollection.insert(restoredCharacter);
      });

      let importedExampleCount = 0;
      backup.exampleCharacters.forEach((exampleCharacter) => {
        if (
          !exampleCharactersCollection.has(exampleCharacter.id) &&
          exampleCharactersCollection.size < MAX_EXAMPLE_CHARACTER_COUNT
        ) {
          exampleCharactersCollection.insert(exampleCharacter);
          importedExampleCount += 1;
        }
      });

      if (backup.connectionSettings) {
        const restoredSettings = backup.connectionSettings;
        // The backup never contains API credentials; keep whatever key is already stored.
        setStoredGenerationSettings((previousSettings) => ({
          ...restoredSettings,
          apiKeyCiphertext: sanitizeCharacterGenerationConnectionSettings(previousSettings).apiKeyCiphertext,
        }));
      }

      const summaryParts = [
        `${backup.characters.length} characters`,
        `${importedExampleCount} examples`,
        backup.connectionSettings ? 'settings applied' : null,
      ].filter((part): part is string => part !== null);

      toastSuccess('Backup restored', summaryParts.join(' | '));
    },
    [setStoredGenerationSettings],
  );

  const handleImport = useCallback(
    async (file: File) => {
      try {
        if (isArchiveFile(file)) {
          const importedArchive = await importArchiveFile(file);

          if (importedArchive.kind === 'backup') {
            await restoreFullBackup(importedArchive.backup);
            return;
          }

          for (const importedCardFile of importedArchive.cards) {
            await importCardAsCharacter(importedCardFile);
          }

          toastSuccess(
            'Characters imported',
            importedArchive.cards.length === 1
              ? importedArchive.cards[0].fileName
              : `${importedArchive.cards.length} characters were imported from the archive.`,
          );

          if (importedArchive.failedPaths.length > 0) {
            toastError('Some archive entries were skipped', importedArchive.failedPaths.join(' | '));
          }

          return;
        }

        const importedCardFile = await importCharacterCardFile(file);
        await importCardAsCharacter(importedCardFile);
        toastSuccess('Character imported', importedCardFile.fileName);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The selected file could not be imported.';
        toastError('Import failed', message);
        throw error;
      }
    },
    [importCardAsCharacter, restoreFullBackup],
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
          const assetId = generateUuid();
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

  const updateAlternateGreetingTemplateId = useCallback(
    (index: number, templateId: string | null) => updateFieldTemplateId(`alternate_greetings:${index}`, templateId),
    [updateFieldTemplateId],
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

  const updateCustomFieldTemplateId = useCallback(
    (id: string, templateId: string | null) => updateFieldTemplateId(`custom:${id}`, templateId),
    [updateFieldTemplateId],
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

  const updateExportSettings = useCallback(
    (patch: Partial<iExportSettings>) => {
      setExportSettings((previousSettings) => ({ ...previousSettings, ...patch }));
    },
    [setExportSettings],
  );

  const getActiveCardExportOptions = useCallback(
    () => ({
      detailLevel: exportSettings.detailLevel,
      promptSettings: characterLibraryCollection.get(activeCharacterId)?.promptSettings ?? null,
      portraitCropRect,
    }),
    [activeCharacterId, exportSettings.detailLevel, portraitCropRect],
  );

  const handleExportJson = useCallback(async () => {
    try {
      await exportCharacterCardJson(card, getActiveCardExportOptions());
      toastSuccess('JSON exported', 'The hybrid V1+V2 card file has been downloaded.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The character card could not be exported as JSON.';
      toastError('JSON export failed', message);
      throw error;
    }
  }, [card, getActiveCardExportOptions]);

  const handleExportPng = useCallback(async () => {
    if (!portraitBlob) {
      toastError('PNG export failed', 'Add a portrait image before exporting PNG.');
      return;
    }

    try {
      await exportCharacterCardPng(card, portraitBlob, portraitCropRect, getActiveCardExportOptions());
      toastSuccess('PNG exported', 'The portrait now contains an updated `chara` metadata chunk.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The character card could not be exported as PNG.';
      toastError('PNG export failed', message);
      throw error;
    }
  }, [card, getActiveCardExportOptions, portraitBlob, portraitCropRect]);

  const handleBulkExport = useCallback(
    async (characterIds: string[]) => {
      try {
        const bulkCharacters: iBulkExportCharacter[] = [];

        for (const characterId of characterIds) {
          const item = characterLibraryCollection.get(characterId);

          if (!item) {
            continue;
          }

          const characterPortraitBlob = item.portrait ? await readCharacterAssetBlob(item.portrait.assetId) : null;
          bulkCharacters.push({ item, portraitBlob: characterPortraitBlob });
        }

        if (bulkCharacters.length === 0) {
          toastError('Bulk export failed', 'Select at least one character to export.');
          return;
        }

        await exportCharactersArchive(bulkCharacters, exportSettings.detailLevel, exportSettings.archiveFormat);
        toastSuccess(
          'Characters exported',
          `${bulkCharacters.length} ${bulkCharacters.length === 1 ? 'character card' : 'character cards'} were bundled into the archive.`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The selected characters could not be exported.';
        toastError('Bulk export failed', message);
        throw error;
      }
    },
    [exportSettings.archiveFormat, exportSettings.detailLevel],
  );

  const handleExportAll = useCallback(async () => {
    try {
      const assets: iBackupPortraitAsset[] = [];

      for (const character of characterLibrary) {
        if (!character.portrait) {
          continue;
        }

        const assetBlob = await readCharacterAssetBlob(character.portrait.assetId);

        if (assetBlob) {
          assets.push({
            assetId: character.portrait.assetId,
            mimeType: character.portrait.mimeType,
            bytes: new Uint8Array(await assetBlob.arrayBuffer()),
          });
        }
      }

      await exportFullBackupArchive(
        {
          characters: characterLibrary,
          exampleCharacters,
          connectionSettings: sanitizeCharacterGenerationConnectionSettings(generationSettings),
          assets,
        },
        exportSettings.archiveFormat,
      );

      toastSuccess('Backup exported', 'The archive contains every character, portrait, example, and setting.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The backup archive could not be created.';
      toastError('Backup export failed', message);
      throw error;
    }
  }, [characterLibrary, exampleCharacters, exportSettings.archiveFormat, generationSettings]);

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
    replaceCard,
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

    fieldTemplates,
    getTemplateOptionsForTargetKey,
    getTemplatesForField,
    addFieldTemplate,
    updateFieldTemplate,
    removeFieldTemplate,
    duplicateFieldTemplate,

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
    updateStandardFieldTemplateId,

    greetingGenerationStates,
    updateAlternateGreetingShouldUseGeneralCharacterIdea,
    updateAlternateGreetingInstruction,
    updateAlternateGreetingTemplateId,
    generateAlternateGreeting,
    cancelAlternateGreetingGeneration,
    revertAlternateGreetingRewrite,
    resolveAlternateGreetingRewriteReview,
    acceptAlternateGreetingRewrite,

    customFieldGenerationStates,
    updateCustomFieldShouldUseGeneralCharacterIdea,
    updateCustomFieldInstruction,
    updateCustomFieldTemplateId,
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
    handleBulkExport,
    handleExportAll,
    exportSettings,
    updateExportSettings,
    handleCreateCharacter,
    handleSelectCharacter,
    handleDuplicateCharacter,
    handleRemoveCharacter,
  };
}
