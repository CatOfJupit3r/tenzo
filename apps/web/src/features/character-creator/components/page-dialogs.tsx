import { useCharacterCreatorContext } from '../context/character-creator-context/character-creator-context.hooks';
import { ExportDialog } from './export-dialog';
import { ImportDialog } from './import-dialog';

export function PageDialogs() {
  const {
    isImportDialogOpen,
    setIsImportDialogOpen,
    handleImport,
    isExportDialogOpen,
    setIsExportDialogOpen,
    portraitBlob,
    handleExportJson,
    handleExportPng,
  } = useCharacterCreatorContext();

  return (
    <>
      <ImportDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onImportFile={handleImport} />
      <ExportDialog
        isOpen={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        hasPortrait={portraitBlob !== null}
        onExportJson={handleExportJson}
        onExportPng={handleExportPng}
      />
    </>
  );
}
