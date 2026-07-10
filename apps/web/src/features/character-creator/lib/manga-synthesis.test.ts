import { describe, expect, it } from 'vitest';

import {
  attachMangaRunManifest,
  MANGA_RUN_STAGE_STATUSES,
  MANGA_SYNTHESIS_ARTIFACT_FORMATS,
  MANGA_SYNTHESIS_ARTIFACT_VERSION,
  parseMangaRunManifestJson,
  parseMangaSynthesisJson,
} from './manga-synthesis';
import type { iMangaRunManifestV1, iMangaSynthesisV1 } from './manga-synthesis';
import { buildMangaSynthesisAttachment, MAX_MANGA_SYNTHESIS_CONTEXT_CHARACTERS } from './manga-synthesis-context';

function createSynthesis(): iMangaSynthesisV1 {
  return {
    folderName: 'chapter-7',
    title: 'Moonlit Oath',
    sourcePages: [1, 2, 3, 4],
    premise: 'Mira tries to protect a forbidden shrine without exposing her pact.',
    storyRetelling: 'LARGE_TRANSCRIPT_LIKE_RETELLING_THAT_MUST_NOT_ENTER_CONTEXT',
    scenes: [
      {
        order: 1,
        title: 'At the shrine gate',
        summary: 'Mira refuses to abandon the shrine despite the approaching patrol.',
        pages: [2, 3],
        characters: ['Mira', 'Captain Ren'],
        emotionalBeat: 'Defiant fear',
        confidence: 0.8,
        notes: [],
      },
    ],
    timeline: [],
    characters: [
      {
        name: 'Mira',
        aliases: ['The shrine keeper'],
        role: 'Reluctant guardian',
        appearance: {
          summary: 'A young woman in layered ceremonial robes.',
          hair: 'Long black hair',
          eyes: 'Gray',
          build: 'Slender',
          distinctiveFeatures: ['Moon-shaped scar beneath her left eye'],
        },
        outfits: [
          {
            label: 'Shrine robes',
            description: 'White and vermilion robes with a dark traveling cloak.',
            pages: [1, 2],
            confidence: 0.7,
            notes: [],
          },
        ],
        bodyLanguage: ['Keeps one hand close to the hidden talisman.'],
        personality: ['Protective', 'Guarded with strangers'],
        speechStyle: ['Formal', 'Short answers under pressure'],
        goals: ['Keep the shrine sealed'],
        fears: ['The patrol discovering her pact'],
        relationships: [
          {
            character: 'Captain Ren',
            relationship: 'Distrusts him but believes he may be honorable.',
            evidencePages: [3],
            confidence: 0.55,
            notes: [],
          },
        ],
        roleplayNotes: ['Deflect direct questions about the talisman.'],
        uncertainties: ['The exact origin of the scar is not shown.'],
        sourcePages: [1, 2, 3],
        confidence: 0.45,
      },
    ],
    world: {
      settingSummary: 'A mountain province where shrines regulate dangerous pacts.',
      locations: ['Moon shrine'],
      socialRules: [],
      worldRules: ['Breaking a shrine seal releases the bound spirit.'],
      importantObjects: ['Hidden talisman'],
      tone: ['Ceremonial', 'Tense'],
      genre: ['Fantasy drama'],
      timeline: [],
      currentState: 'The patrol has reached the shrine road.',
      scenarioHooks: ['Question Mira about the broken outer ward.'],
      continuityConstraints: ['Mira has not admitted that she carries the talisman.'],
      warnings: [],
    },
    continuityNotes: [],
    warnings: ['Synthesis was generated from fallback page summaries.'],
    confidence: 0.2,
  };
}

function createRunManifest(folderName = 'chapter-7'): iMangaRunManifestV1 {
  return {
    version: MANGA_SYNTHESIS_ARTIFACT_VERSION,
    folderName,
    sourceFolder: `D:\\manga\\${folderName}`,
    pageCount: 4,
    pagesNeedingReview: 2,
    stages: {
      extraction: MANGA_RUN_STAGE_STATUSES.partial,
      cleanTranscript: MANGA_RUN_STAGE_STATUSES.complete,
      overview: MANGA_RUN_STAGE_STATUSES.complete,
      synthesis: MANGA_RUN_STAGE_STATUSES.complete,
      guidanceAssessment: MANGA_RUN_STAGE_STATUSES.skipped,
    },
    artifacts: ['synthesis.json', 'transcript.md', 'extraction.json'],
    guidance: {
      present: false,
    },
    warnings: ['Two pages had unreadable dialogue.'],
  };
}

describe('manga synthesis artifacts', () => {
  it('parses an unversioned manga-to-text synthesis as format v1', () => {
    const artifact = parseMangaSynthesisJson(JSON.stringify(createSynthesis()));

    expect(artifact.format).toBe(MANGA_SYNTHESIS_ARTIFACT_FORMATS['manga-to-text.synthesis']);
    expect(artifact.version).toBe(1);
    expect(artifact.synthesis.characters[0]?.name).toBe('Mira');
    expect(artifact.runManifest).toBeNull();
  });

  it('rejects JSON that is not a synthesis artifact', () => {
    expect(() =>
      parseMangaSynthesisJson(JSON.stringify({ folderName: 'chapter-7', pages: [{ pageNumber: 1 }] })),
    ).toThrow(/does not match manga-to-text format v1/);
  });

  it('parses and matches an optional run manifest', () => {
    const artifact = parseMangaSynthesisJson(JSON.stringify(createSynthesis()));
    const runManifest = parseMangaRunManifestJson(JSON.stringify(createRunManifest()));

    expect(attachMangaRunManifest(artifact, runManifest).runManifest?.pagesNeedingReview).toBe(2);
    expect(() => attachMangaRunManifest(artifact, createRunManifest('another-chapter'))).toThrow(
      /belongs to another-chapter/,
    );
  });

  it('builds bounded selected-character context without the full retelling', () => {
    const artifact = attachMangaRunManifest(
      parseMangaSynthesisJson(JSON.stringify(createSynthesis())),
      createRunManifest(),
    );
    const attachment = buildMangaSynthesisAttachment({
      id: 'attachment-1',
      artifact,
      characterIndex: 0,
    });

    expect(attachment.title).toBe('Moonlit Oath - Mira');
    expect(attachment.confidence).toBe(0.2);
    expect(attachment.content).toContain('Selected character: Mira');
    expect(attachment.content).toContain('Evidence pages: 1, 2, 3');
    expect(attachment.content).toContain('At the shrine gate');
    expect(attachment.content).not.toContain('LARGE_TRANSCRIPT_LIKE_RETELLING');
    expect(attachment.content.length).toBeLessThanOrEqual(MAX_MANGA_SYNTHESIS_CONTEXT_CHARACTERS);
    expect(attachment.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Low-confidence manga synthesis'),
        expect.stringContaining('fallback page summaries'),
        expect.stringContaining('2 of 4 source pages need review'),
        expect.stringContaining('Two pages had unreadable dialogue'),
      ]),
    );
  });

  it('requires an explicit valid character selection', () => {
    const artifact = parseMangaSynthesisJson(JSON.stringify(createSynthesis()));

    expect(() => buildMangaSynthesisAttachment({ id: 'attachment-1', artifact, characterIndex: 99 })).toThrow(
      /Select a character/,
    );
  });
});
