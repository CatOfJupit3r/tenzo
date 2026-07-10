import { useMemo, useState } from 'react';
import { LuFileJson, LuPaperclip, LuTrash2, LuTriangleAlert } from 'react-icons/lu';

import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@~/components/ui/dialog';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { SingleSelect } from '@~/components/ui/select/select';
import type { iOptionType } from '@~/components/ui/select/types';
import { generateUuid } from '@~/utils/uuid';

import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KINDS } from '../lib/character-assistant-contracts';
import { attachMangaRunManifest, parseMangaRunManifestJson, parseMangaSynthesisJson } from '../lib/manga-synthesis';
import type { iParsedMangaSynthesisArtifact } from '../lib/manga-synthesis';
import {
  buildMangaSynthesisAttachment,
  formatMangaSynthesisConfidence,
  getMangaSynthesisConfidenceLevel,
  MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVELS,
} from '../lib/manga-synthesis-context';

const MAX_SYNTHESIS_FILE_BYTES = 2 * 1024 * 1024;
const MAX_RUN_MANIFEST_FILE_BYTES = 256 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getConfidenceBadgeVariant(confidence: number) {
  return getMangaSynthesisConfidenceLevel(confidence) === MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVELS.low
    ? 'outline'
    : 'secondary';
}

function createCharacterOptions(artifact: iParsedMangaSynthesisArtifact): iOptionType[] {
  return artifact.synthesis.characters
    .map((character, characterIndex) => ({
      character,
      characterIndex,
    }))
    .sort(
      (left, right) =>
        right.character.confidence - left.character.confidence ||
        right.character.sourcePages.length - left.character.sourcePages.length,
    )
    .map(({ character, characterIndex }) => ({
      value: String(characterIndex),
      label: character.name.trim() || `Unnamed character ${characterIndex + 1}`,
      description: `${character.role.trim().slice(0, 160) || 'Role not identified'} - ${formatMangaSynthesisConfidence(character.confidence)} - ${character.sourcePages.length} source page${character.sourcePages.length === 1 ? '' : 's'}`,
    }));
}

async function readMangaArtifactFiles(files: FileList) {
  const selectedFiles = [...files];
  const synthesisFile =
    selectedFiles.find((file) => file.name.toLocaleLowerCase() === 'synthesis.json') ??
    selectedFiles.find((file) => file.name.toLocaleLowerCase() !== 'run-manifest.json');
  const runManifestFile = selectedFiles.find((file) => file.name.toLocaleLowerCase() === 'run-manifest.json');

  if (!synthesisFile) {
    throw new Error('Choose synthesis.json. run-manifest.json is optional and cannot be attached by itself.');
  }

  if (synthesisFile.size > MAX_SYNTHESIS_FILE_BYTES) {
    throw new Error(
      `${synthesisFile.name} is ${formatFileSize(synthesisFile.size)}. Synthesis imports are limited to ${formatFileSize(MAX_SYNTHESIS_FILE_BYTES)}.`,
    );
  }

  if (runManifestFile && runManifestFile.size > MAX_RUN_MANIFEST_FILE_BYTES) {
    throw new Error(
      `${runManifestFile.name} is ${formatFileSize(runManifestFile.size)}. Run manifests are limited to ${formatFileSize(MAX_RUN_MANIFEST_FILE_BYTES)}.`,
    );
  }

  const artifact = parseMangaSynthesisJson(await synthesisFile.text(), synthesisFile.name);

  if (!runManifestFile) {
    return artifact;
  }

  return attachMangaRunManifest(artifact, parseMangaRunManifestJson(await runManifestFile.text()));
}

export function MangaSynthesisAttachment() {
  const { contextAttachments, addContextAttachment, removeContextAttachment } = useCharacterAssistant();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [artifact, setArtifact] = useState<iParsedMangaSynthesisArtifact | null>(null);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mangaAttachments = contextAttachments.filter(
    (attachment) => attachment.kind === CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KINDS.manga_synthesis,
  );
  const characterOptions = useMemo(() => (artifact ? createCharacterOptions(artifact) : []), [artifact]);
  const attachmentPreview = useMemo(() => {
    if (!artifact || selectedCharacterIndex === null) {
      return null;
    }

    return buildMangaSynthesisAttachment({
      id: 'manga-synthesis-preview',
      artifact,
      characterIndex: Number(selectedCharacterIndex),
    });
  }, [artifact, selectedCharacterIndex]);

  const resetImport = () => {
    setArtifact(null);
    setSelectedCharacterIndex(null);
    setErrorMessage(null);
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setIsReadingFiles(true);
    setErrorMessage(null);

    try {
      const parsedArtifact = await readMangaArtifactFiles(files);
      setArtifact(parsedArtifact);
      setSelectedCharacterIndex(parsedArtifact.synthesis.characters.length === 1 ? '0' : null);
    } catch (error) {
      setArtifact(null);
      setSelectedCharacterIndex(null);
      setErrorMessage(error instanceof Error ? error.message : 'The manga synthesis could not be read.');
    } finally {
      setIsReadingFiles(false);
    }
  };

  const handleAttach = () => {
    if (!artifact || selectedCharacterIndex === null) {
      return;
    }

    addContextAttachment(
      buildMangaSynthesisAttachment({
        id: generateUuid(),
        artifact,
        characterIndex: Number(selectedCharacterIndex),
      }),
    );
    setIsDialogOpen(false);
    resetImport();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setIsDialogOpen(true)}>
          <LuPaperclip className="size-3.5" />
          Attach manga synthesis
        </Button>
        {mangaAttachments.map((attachment) => (
          <div key={attachment.id} className="flex min-w-0 items-center gap-1 rounded-full border bg-muted/30 pl-2">
            <LuFileJson className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-52 truncate text-xs">{attachment.title}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 rounded-full"
              tooltip={`Remove ${attachment.title}`}
              onClick={() => removeContextAttachment(attachment.id)}
            >
              <LuTrash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) {
            resetImport();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Attach manga synthesis</DialogTitle>
            <DialogDescription>
              Select one character from manga-to-text&apos;s synthesis.json. Tenzo sends a bounded evidence brief to the
              assistant; it does not import the artifact as a CharacterCard or send extraction and transcript files.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="manga-synthesis-files">Synthesis artifact</Label>
              <Input
                id="manga-synthesis-files"
                type="file"
                accept=".json,application/json"
                multiple
                disabled={isReadingFiles}
                onChange={(event) => {
                  void handleFilesSelected(event.currentTarget.files);
                  event.currentTarget.value = '';
                }}
              />
              <p className="text-xs text-muted-foreground">
                Choose synthesis.json. You may include its matching run-manifest.json to carry review status and
                warnings.
              </p>
            </div>

            {errorMessage ? (
              <div role="alert" className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            ) : null}

            {artifact ? (
              <div className="grid gap-4 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {artifact.synthesis.title.trim() || artifact.synthesis.folderName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {artifact.synthesis.sourcePages.length} pages - {artifact.synthesis.characters.length} identified
                      characters - format v{artifact.version}
                    </p>
                  </div>
                  <Badge variant={getConfidenceBadgeVariant(artifact.synthesis.confidence)}>
                    {formatMangaSynthesisConfidence(artifact.synthesis.confidence)} confidence
                  </Badge>
                </div>

                {artifact.synthesis.characters.length > 0 ? (
                  <div className="grid gap-2">
                    <Label htmlFor="manga-synthesis-character">Character to attach</Label>
                    <SingleSelect
                      inputId="manga-synthesis-character"
                      aria-label="Character to attach"
                      placeholder="Search identified characters..."
                      value={selectedCharacterIndex}
                      options={characterOptions}
                      onValueChange={setSelectedCharacterIndex}
                    />
                    <p className="text-xs text-muted-foreground">
                      Identified names can be duplicated or uncertain. Check confidence and source-page coverage before
                      attaching.
                    </p>
                  </div>
                ) : (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    This synthesis contains no identified characters to attach.
                  </div>
                )}

                {attachmentPreview ? (
                  <div className="grid gap-2 rounded-lg border bg-background/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Assistant context preview</p>
                      <Badge variant={getConfidenceBadgeVariant(attachmentPreview.confidence ?? 0)}>
                        {formatMangaSynthesisConfidence(attachmentPreview.confidence ?? 0)} confidence
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {attachmentPreview.content.length.toLocaleString()} context characters -{' '}
                      {attachmentPreview.warnings.length} warning{attachmentPreview.warnings.length === 1 ? '' : 's'}
                    </p>
                    {attachmentPreview.warnings.length > 0 ? (
                      <ul className="grid gap-1 text-xs text-muted-foreground">
                        {attachmentPreview.warnings.slice(0, 3).map((warning) => (
                          <li key={warning}>- {warning}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!attachmentPreview || isReadingFiles} onClick={handleAttach}>
              Attach selected character
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
