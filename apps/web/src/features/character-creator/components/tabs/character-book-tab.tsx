import { LuBookOpen, LuPlus, LuSparkles, LuTrash2 } from 'react-icons/lu';

import { toastError } from '@~/components/toastifications/create-jsx-toasts';
import { Button } from '@~/components/ui/button';

import { useCharacterAssistant } from '../../context/character-assistant-context.hooks';
import { useCharacterCreatorContext } from '../../context/character-creator-context/character-creator-context.hooks';
import { CHARACTER_EDIT_FIELD_KEYS } from '../../lib/character-edit-proposal';
import { CharacterAssistantStructuredReview } from '../character-assistant-structured-review';
import { CharacterBookEditor } from '../character-book-editor';
import { FIELD_PANEL_CLASS_NAME } from './tabs.constants';

export function CharacterBookTab() {
  const { openAssistantForField, workspace } = useCharacterAssistant();
  const {
    data,
    createCharacterBook,
    removeCharacterBook,
    updateCharacterBook,
    addCharacterBookEntry,
    updateCharacterBookEntry,
    removeCharacterBookEntry,
    reorderCharacterBookEntries,
  } = useCharacterCreatorContext();
  const assistantPatchView = workspace.activePatches.find(
    (patchView) => patchView.patch.fieldKey === CHARACTER_EDIT_FIELD_KEYS.character_book,
  );
  const reportAssistantError = (error: unknown) =>
    toastError('Assistant proposal was not updated', error instanceof Error ? error.message : 'The action failed.');

  return (
    <div className={FIELD_PANEL_CLASS_NAME}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LuBookOpen className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Character Book</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openAssistantForField(CHARACTER_EDIT_FIELD_KEYS.character_book)}
          >
            <LuSparkles className="size-3.5" />
            Ask AI
          </Button>
          {data.character_book ? (
            <Button type="button" variant="outline" size="sm" onClick={removeCharacterBook}>
              <LuTrash2 className="size-4" />
              Remove book
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={createCharacterBook}>
              <LuPlus className="size-4" />
              Create book
            </Button>
          )}
        </div>
      </div>

      {assistantPatchView?.patch.kind === 'character-book' ? (
        <div className="mb-4">
          <CharacterAssistantStructuredReview
            patch={assistantPatchView.patch}
            onApply={() => {
              void workspace
                .applyProposalFields(assistantPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.character_book])
                .catch(reportAssistantError);
            }}
            onReject={() => {
              void workspace
                .rejectProposalFields(assistantPatchView.proposalId, [CHARACTER_EDIT_FIELD_KEYS.character_book])
                .catch(reportAssistantError);
            }}
          />
        </div>
      ) : null}

      {data.character_book ? (
        <CharacterBookEditor
          characterBook={data.character_book}
          onBookChange={updateCharacterBook}
          onAddEntry={addCharacterBookEntry}
          onEntryChange={updateCharacterBookEntry}
          onRemoveEntry={removeCharacterBookEntry}
          onMoveEntry={reorderCharacterBookEntries}
        />
      ) : (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          This card does not have a character book.
        </p>
      )}
    </div>
  );
}
