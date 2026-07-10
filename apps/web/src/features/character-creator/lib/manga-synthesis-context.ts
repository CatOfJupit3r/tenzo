import { z } from 'zod';

import {
  CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KINDS,
  CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA,
} from './character-assistant-contracts';
import type { iCharacterAssistantContextAttachment } from './character-assistant-contracts';
import type { iMangaRunManifestV1, iMangaSynthesisCharacter, iParsedMangaSynthesisArtifact } from './manga-synthesis';
import { MANGA_RUN_STAGE_STATUSES } from './manga-synthesis';

export const MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVEL_SCHEMA = z.enum(['low', 'medium', 'high']);
export const MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVELS = MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVEL_SCHEMA.enum;

export const MAX_MANGA_SYNTHESIS_CONTEXT_CHARACTERS = 10_000;

const MAX_CONTEXT_LIST_ITEMS = 8;
const MAX_CONTEXT_ITEM_CHARACTERS = 500;
const MAX_CONTEXT_SCENES = 5;
const MAX_ATTACHMENT_WARNINGS = 20;
const MAX_ATTACHMENT_WARNING_CHARACTERS = 400;

export interface iBuildMangaSynthesisAttachmentInput {
  id: string;
  artifact: iParsedMangaSynthesisArtifact;
  characterIndex: number;
}

function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxCharacters: number) {
  const normalizedValue = normalizeInlineText(value);

  if (normalizedValue.length <= maxCharacters) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxCharacters - 3)).trimEnd()}...`;
}

function uniqueNonEmpty(values: readonly string[]) {
  const seen = new Set<string>();

  return values.flatMap((value) => {
    const normalizedValue = normalizeInlineText(value);
    const comparisonValue = normalizedValue.toLocaleLowerCase();

    if (!normalizedValue || seen.has(comparisonValue)) {
      return [];
    }

    seen.add(comparisonValue);
    return [normalizedValue];
  });
}

function formatPages(pages: readonly number[]) {
  return pages.length > 0 ? pages.join(', ') : 'not recorded';
}

export function getMangaSynthesisConfidenceLevel(confidence: number) {
  if (confidence >= 0.75) {
    return MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVELS.high;
  }

  if (confidence >= 0.5) {
    return MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVELS.medium;
  }

  return MANGA_SYNTHESIS_CONTEXT_CONFIDENCE_LEVELS.low;
}

export function formatMangaSynthesisConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}% (${getMangaSynthesisConfidenceLevel(confidence)})`;
}

function formatListSection(label: string, values: readonly string[]) {
  const items = uniqueNonEmpty(values)
    .slice(0, MAX_CONTEXT_LIST_ITEMS)
    .map((value) => `- ${truncateText(value, MAX_CONTEXT_ITEM_CHARACTERS)}`);

  return items.length > 0 ? [`${label}:`, ...items].join('\n') : '';
}

function formatAppearance(character: iMangaSynthesisCharacter) {
  const details = [
    character.appearance.summary,
    character.appearance.hair ? `Hair: ${character.appearance.hair}` : '',
    character.appearance.eyes ? `Eyes: ${character.appearance.eyes}` : '',
    character.appearance.build ? `Build: ${character.appearance.build}` : '',
    ...character.appearance.distinctiveFeatures.map((feature) => `Distinctive feature: ${feature}`),
  ];

  return formatListSection('Appearance', details);
}

function formatOutfits(character: iMangaSynthesisCharacter) {
  const outfits = [...character.outfits]
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 4)
    .map((outfit) => {
      const label = outfit.label.trim() || 'Unlabeled outfit';
      return `${label}: ${outfit.description} (confidence ${formatMangaSynthesisConfidence(outfit.confidence)}; pages ${formatPages(outfit.pages)})`;
    });

  return formatListSection('Observed outfits', outfits);
}

function formatRelationships(character: iMangaSynthesisCharacter) {
  const relationships = [...character.relationships]
    .sort((left, right) => right.confidence - left.confidence)
    .map(
      (relationship) =>
        `${relationship.character || 'Unnamed character'}: ${relationship.relationship} (confidence ${formatMangaSynthesisConfidence(relationship.confidence)}; pages ${formatPages(relationship.evidencePages)})`,
    );

  return formatListSection('Relationships', relationships);
}

function normalizeIdentity(value: string) {
  return normalizeInlineText(value).toLocaleLowerCase();
}

function doesSceneContainCharacter(sceneCharacters: readonly string[], identities: readonly string[]) {
  return sceneCharacters.some((sceneCharacter) => {
    const normalizedSceneCharacter = normalizeIdentity(sceneCharacter);

    if (normalizedSceneCharacter.length < 3) {
      return false;
    }

    return identities.some(
      (identity) =>
        normalizedSceneCharacter === identity ||
        normalizedSceneCharacter.includes(identity) ||
        identity.includes(normalizedSceneCharacter),
    );
  });
}

function formatRelevantScenes(artifact: iParsedMangaSynthesisArtifact, character: iMangaSynthesisCharacter) {
  const identities = uniqueNonEmpty([character.name, ...character.aliases])
    .map(normalizeIdentity)
    .filter((identity) => identity.length >= 3);
  const relevantScenes = artifact.synthesis.scenes
    .filter((scene) => doesSceneContainCharacter(scene.characters, identities))
    .slice(0, MAX_CONTEXT_SCENES)
    .map(
      (scene) =>
        `${scene.title || `Scene ${scene.order}`}: ${scene.summary} (confidence ${formatMangaSynthesisConfidence(scene.confidence)}; pages ${formatPages(scene.pages)})`,
    );

  return formatListSection('Relevant scenes', relevantScenes);
}

function createRunWarnings(runManifest: iMangaRunManifestV1 | null) {
  if (!runManifest) {
    return [];
  }

  const stageWarnings = Object.entries(runManifest.stages).flatMap(([stageName, status]) =>
    status === MANGA_RUN_STAGE_STATUSES.complete ? [] : [`${stageName} stage status: ${status}.`],
  );
  const reviewWarning =
    runManifest.pagesNeedingReview > 0
      ? [`${runManifest.pagesNeedingReview} of ${runManifest.pageCount} source pages need review.`]
      : [];

  return [...stageWarnings, ...reviewWarning, ...runManifest.warnings];
}

function createAttachmentWarnings(
  artifact: iParsedMangaSynthesisArtifact,
  character: iMangaSynthesisCharacter,
  attachmentConfidence: number,
) {
  const confidenceWarnings = [
    attachmentConfidence < 0.5
      ? `Low-confidence manga synthesis (${formatMangaSynthesisConfidence(attachmentConfidence)}). Treat details as uncertain evidence, not canon.`
      : '',
    character.confidence < 0.5
      ? `The selected character identity is low confidence (${formatMangaSynthesisConfidence(character.confidence)}).`
      : '',
  ];

  return uniqueNonEmpty([
    ...confidenceWarnings,
    ...artifact.importWarnings,
    ...artifact.synthesis.warnings,
    ...artifact.synthesis.world.warnings,
    ...character.uncertainties,
    ...createRunWarnings(artifact.runManifest),
  ])
    .slice(0, MAX_ATTACHMENT_WARNINGS)
    .map((warning) => truncateText(warning, MAX_ATTACHMENT_WARNING_CHARACTERS));
}

function limitContext(content: string) {
  if (content.length <= MAX_MANGA_SYNTHESIS_CONTEXT_CHARACTERS) {
    return content;
  }

  const truncationNotice = '\n\n[Context truncated to remain within the manga synthesis attachment limit.]';
  return `${content.slice(0, MAX_MANGA_SYNTHESIS_CONTEXT_CHARACTERS - truncationNotice.length).trimEnd()}${truncationNotice}`;
}

export function buildMangaSynthesisAttachment({
  id,
  artifact,
  characterIndex,
}: iBuildMangaSynthesisAttachmentInput): iCharacterAssistantContextAttachment {
  const character = artifact.synthesis.characters[characterIndex];

  if (!character) {
    throw new Error('Select a character from the manga synthesis before attaching it.');
  }

  const attachmentConfidence = Math.min(artifact.synthesis.confidence, character.confidence);
  const warnings = createAttachmentWarnings(artifact, character, attachmentConfidence);
  const title = truncateText(
    `${artifact.synthesis.title.trim() || artifact.synthesis.folderName} - ${character.name.trim() || 'Unnamed character'}`,
    240,
  );
  const identity = [
    `Selected character: ${character.name.trim() || 'Unnamed character'}`,
    character.aliases.length > 0 ? `Aliases: ${uniqueNonEmpty(character.aliases).join(', ')}` : '',
    character.role.trim() ? `Observed role: ${truncateText(character.role, MAX_CONTEXT_ITEM_CHARACTERS)}` : '',
    `Character confidence: ${formatMangaSynthesisConfidence(character.confidence)}`,
    `Synthesis confidence: ${formatMangaSynthesisConfidence(artifact.synthesis.confidence)}`,
    `Evidence pages: ${formatPages(character.sourcePages)}`,
  ]
    .filter(Boolean)
    .join('\n');
  const sections = [
    'MANGA SYNTHESIS CONTEXT (manga-to-text format v1)',
    'Use this as evidence for character-card proposals. Preserve uncertainty, do not invent missing details, and prefer facts with page references and higher confidence.',
    identity,
    artifact.synthesis.premise.trim() ? `Story premise:\n${truncateText(artifact.synthesis.premise, 1_000)}` : '',
    formatAppearance(character),
    formatOutfits(character),
    formatListSection('Body language', character.bodyLanguage),
    formatListSection('Personality evidence', character.personality),
    formatListSection('Speech style evidence', character.speechStyle),
    formatListSection('Observed goals', character.goals),
    formatListSection('Observed fears', character.fears),
    formatRelationships(character),
    formatListSection('Roleplay notes', character.roleplayNotes),
    formatRelevantScenes(artifact, character),
    artifact.synthesis.world.settingSummary.trim()
      ? `Setting:\n${truncateText(artifact.synthesis.world.settingSummary, 1_000)}`
      : '',
    formatListSection('Tone', artifact.synthesis.world.tone),
    formatListSection('Genre', artifact.synthesis.world.genre),
    artifact.synthesis.world.currentState.trim()
      ? `Current story state:\n${truncateText(artifact.synthesis.world.currentState, 1_000)}`
      : '',
    formatListSection('Scenario hooks', artifact.synthesis.world.scenarioHooks),
    formatListSection('Continuity constraints', artifact.synthesis.world.continuityConstraints),
    formatListSection('Uncertainties and warnings', warnings),
  ].filter(Boolean);

  return CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA.parse({
    id,
    kind: CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KINDS.manga_synthesis,
    title,
    content: limitContext(sections.join('\n\n')),
    warnings,
    confidence: attachmentConfidence,
  });
}
