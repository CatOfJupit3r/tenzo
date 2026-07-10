import { useMemo, useState } from 'react';
import { LuFileJson, LuPaperclip, LuTrash2, LuTriangleAlert } from 'react-icons/lu';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@~/components/ui/accordion';
import { Badge } from '@~/components/ui/badge';
import { Button } from '@~/components/ui/button/button';
import { Checkbox } from '@~/components/ui/checkbox';
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

import { useCharacterAssistant } from '../context/character-assistant-context.hooks';
import { CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KINDS } from '../lib/character-assistant-contracts';
import {
  attachMangaExtraction,
  attachMangaOverview,
  attachMangaRunManifest,
  parseMangaExtractionJson,
  parseMangaOverviewJson,
  parseMangaRunManifestJson,
  parseMangaSynthesisJson,
} from '../lib/manga-synthesis';
import type { iMangaSynthesisCharacter, iParsedMangaSynthesisArtifact } from '../lib/manga-synthesis';
import {
  buildMangaSynthesisAttachment,
  formatMangaSynthesisConfidence,
  getMangaSynthesisConfidenceLevel,
  MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVELS,
} from '../lib/manga-synthesis-context';

const MAX_SYNTHESIS_FILE_BYTES = 2 * 1024 * 1024;
const MAX_RUN_MANIFEST_FILE_BYTES = 256 * 1024;
const MAX_EXTRACTION_FILE_BYTES = 8 * 1024 * 1024;
const MAX_OVERVIEW_FILE_BYTES = 256 * 1024;

interface iMangaCharacterOption {
  characterIndex: number;
  character: iMangaSynthesisCharacter;
  label: string;
  description: string;
}

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

function slugify(value: string) {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function createMangaAttachmentId(artifact: iParsedMangaSynthesisArtifact, character: iMangaSynthesisCharacter) {
  const runKey = slugify(artifact.synthesis.folderName) || 'manga-run';
  const characterKey = slugify(character.name) || slugify(character.role) || 'unnamed-character';
  return `manga_synthesis:${runKey}:${characterKey}`;
}

function createCharacterOptions(artifact: iParsedMangaSynthesisArtifact): iMangaCharacterOption[] {
  return artifact.synthesis.characters
    .map((character, characterIndex) => ({ character, characterIndex }))
    .sort(
      (left, right) =>
        right.character.confidence - left.character.confidence ||
        right.character.sourcePages.length - left.character.sourcePages.length,
    )
    .map(({ character, characterIndex }) => ({
      characterIndex,
      character,
      label: character.name.trim() || `Unnamed character ${characterIndex + 1}`,
      description: `${character.role.trim().slice(0, 160) || 'Role not identified'} - ${formatMangaSynthesisConfidence(character.confidence)} - ${character.sourcePages.length} source page${character.sourcePages.length === 1 ? '' : 's'}`,
    }));
}

async function readMangaArtifactFiles(files: FileList) {
  const selectedFiles = [...files];
  const synthesisFile =
    selectedFiles.find((file) => file.name.toLocaleLowerCase() === 'synthesis.json') ??
    selectedFiles.find(
      (file) => !['run-manifest.json', 'extraction.json', 'overview.json'].includes(file.name.toLocaleLowerCase()),
    );
  const runManifestFile = selectedFiles.find((file) => file.name.toLocaleLowerCase() === 'run-manifest.json');
  const extractionFile = selectedFiles.find((file) => file.name.toLocaleLowerCase() === 'extraction.json');
  const overviewFile = selectedFiles.find((file) => file.name.toLocaleLowerCase() === 'overview.json');

  if (!synthesisFile) {
    throw new Error('Choose synthesis.json. The other manga-to-text files cannot be attached by themselves.');
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

  if (extractionFile && extractionFile.size > MAX_EXTRACTION_FILE_BYTES) {
    throw new Error(
      `${extractionFile.name} is ${formatFileSize(extractionFile.size)}. Extraction imports are limited to ${formatFileSize(MAX_EXTRACTION_FILE_BYTES)}.`,
    );
  }

  if (overviewFile && overviewFile.size > MAX_OVERVIEW_FILE_BYTES) {
    throw new Error(
      `${overviewFile.name} is ${formatFileSize(overviewFile.size)}. Overview imports are limited to ${formatFileSize(MAX_OVERVIEW_FILE_BYTES)}.`,
    );
  }

  let artifact = parseMangaSynthesisJson(await synthesisFile.text(), synthesisFile.name);

  if (runManifestFile) {
    artifact = attachMangaRunManifest(artifact, parseMangaRunManifestJson(await runManifestFile.text()));
  }

  if (extractionFile) {
    artifact = attachMangaExtraction(artifact, parseMangaExtractionJson(await extractionFile.text()));
  }

  if (overviewFile) {
    artifact = attachMangaOverview(artifact, parseMangaOverviewJson(await overviewFile.text()));
  }

  return artifact;
}

export function MangaSynthesisAttachment() {
  const { contextAttachments, addContextAttachment, removeContextAttachment } = useCharacterAssistant();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [artifact, setArtifact] = useState<iParsedMangaSynthesisArtifact | null>(null);
  const [selectedCharacterIndices, setSelectedCharacterIndices] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mangaAttachments = contextAttachments.filter(
    (attachment) => attachment.kind === CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KINDS.manga_synthesis,
  );
  const characterOptions = useMemo(() => (artifact ? createCharacterOptions(artifact) : []), [artifact]);
  const previewsByIndex = useMemo(() => {
    if (!artifact) {
      return new Map<number, ReturnType<typeof buildMangaSynthesisAttachment>>();
    }

    return new Map(
      characterOptions.map(({ characterIndex }) => [
        characterIndex,
        buildMangaSynthesisAttachment({
          id: `manga-synthesis-preview-${characterIndex}`,
          artifact,
          characterIndex,
        }),
      ]),
    );
  }, [artifact, characterOptions]);

  const resetImport = () => {
    setArtifact(null);
    setSelectedCharacterIndices([]);
    setErrorMessage(null);
  };

  const toggleCharacterSelection = (value: string, isSelected: boolean) => {
    setSelectedCharacterIndices((currentIndices) =>
      isSelected ? [...currentIndices, value] : currentIndices.filter((index) => index !== value),
    );
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
      setSelectedCharacterIndices(parsedArtifact.synthesis.characters.length === 1 ? ['0'] : []);
    } catch (error) {
      setArtifact(null);
      setSelectedCharacterIndices([]);
      setErrorMessage(error instanceof Error ? error.message : 'The manga synthesis could not be read.');
    } finally {
      setIsReadingFiles(false);
    }
  };

  const handleAttach = () => {
    if (!artifact || selectedCharacterIndices.length === 0) {
      return;
    }

    for (const selectedIndex of selectedCharacterIndices) {
      const characterIndex = Number(selectedIndex);
      const character = artifact.synthesis.characters[characterIndex];

      if (!character) {
        continue;
      }

      addContextAttachment(
        buildMangaSynthesisAttachment({
          id: createMangaAttachmentId(artifact, character),
          artifact,
          characterIndex,
        }),
      );
    }

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
              Select one or more characters from a manga-to-text run. Tenzo sends a bounded evidence brief per character
              to the assistant, built from synthesis.json and (if included) extraction.json and overview.json - it does
              not import the artifact as a CharacterCard.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="manga-synthesis-files">Manga-to-text artifacts</Label>
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
                Choose synthesis.json. You may also include its matching run-manifest.json, extraction.json, and
                overview.json from the same run to enrich the evidence brief - each is optional.
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
                      {artifact.extraction ? ' - extraction.json included' : ''}
                      {artifact.overview ? ' - overview.json included' : ''}
                    </p>
                  </div>
                  <Badge variant={getConfidenceBadgeVariant(artifact.synthesis.confidence)}>
                    {formatMangaSynthesisConfidence(artifact.synthesis.confidence)} confidence
                  </Badge>
                </div>

                {characterOptions.length > 0 ? (
                  <div className="grid gap-2">
                    <span id="manga-synthesis-characters-label" className="text-sm leading-none font-medium">
                      Characters to attach
                    </span>
                    <Accordion
                      type="multiple"
                      className="grid gap-2"
                      aria-labelledby="manga-synthesis-characters-label"
                    >
                      {characterOptions.map(({ characterIndex, label, character }) => {
                        const value = String(characterIndex);
                        const isSelected = selectedCharacterIndices.includes(value);
                        const preview = previewsByIndex.get(characterIndex) ?? null;

                        return (
                          <AccordionItem
                            key={value}
                            value={value}
                            className="rounded-lg border bg-background/70 px-3 last:border-b"
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`manga-synthesis-character-${value}`}
                                aria-label={`Include ${label}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => toggleCharacterSelection(value, checked === true)}
                              />
                              <AccordionTrigger className="flex-1 py-3">
                                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{label}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {character.role.trim().slice(0, 160) || 'Role not identified'}
                                    </p>
                                  </div>
                                  <Badge variant={getConfidenceBadgeVariant(character.confidence)}>
                                    {formatMangaSynthesisConfidence(character.confidence)}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent>
                              {preview ? (
                                <div className="grid gap-2 rounded-lg border bg-background p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-medium">Assistant context preview</p>
                                    <Badge variant={getConfidenceBadgeVariant(preview.confidence ?? 0)}>
                                      {formatMangaSynthesisConfidence(preview.confidence ?? 0)} confidence
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {preview.content.length.toLocaleString()} context characters -{' '}
                                    {preview.warnings.length} warning{preview.warnings.length === 1 ? '' : 's'}
                                  </p>
                                  {preview.warnings.length > 0 ? (
                                    <ul className="grid gap-1 text-xs text-muted-foreground">
                                      {preview.warnings.slice(0, 3).map((warning) => (
                                        <li key={warning}>- {warning}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>
                              ) : null}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                    <p className="text-xs text-muted-foreground">
                      Identified names can be duplicated or uncertain. Check confidence and source-page coverage before
                      attaching. Expand a character to preview the exact context sent to the assistant.
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
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={selectedCharacterIndices.length === 0 || isReadingFiles}
              onClick={handleAttach}
            >
              {selectedCharacterIndices.length > 0
                ? `Attach ${selectedCharacterIndices.length} character${selectedCharacterIndices.length === 1 ? '' : 's'}`
                : 'Attach selected characters'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
