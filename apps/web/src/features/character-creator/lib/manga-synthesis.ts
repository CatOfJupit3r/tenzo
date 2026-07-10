import { z } from 'zod';

export const MANGA_SYNTHESIS_ARTIFACT_FORMAT_SCHEMA = z.enum(['manga-to-text.synthesis']);
export const MANGA_SYNTHESIS_ARTIFACT_FORMATS = MANGA_SYNTHESIS_ARTIFACT_FORMAT_SCHEMA.enum;
export const MANGA_SYNTHESIS_ARTIFACT_VERSION_SCHEMA = z.literal(1);
export const MANGA_SYNTHESIS_ARTIFACT_VERSION = MANGA_SYNTHESIS_ARTIFACT_VERSION_SCHEMA.value;

export const MANGA_RUN_STAGE_STATUS_SCHEMA = z.enum(['complete', 'partial', 'skipped', 'failed']);
export const MANGA_RUN_STAGE_STATUSES = MANGA_RUN_STAGE_STATUS_SCHEMA.enum;

const PAGE_REFERENCES_SCHEMA = z.array(z.number().int().positive());

const MANGA_OUTFIT_SCHEMA = z.object({
  label: z.string(),
  description: z.string(),
  pages: PAGE_REFERENCES_SCHEMA,
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string()),
});

const MANGA_RELATIONSHIP_SCHEMA = z.object({
  character: z.string(),
  relationship: z.string(),
  evidencePages: PAGE_REFERENCES_SCHEMA,
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string()),
});

export const MANGA_SYNTHESIS_CHARACTER_SCHEMA = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  role: z.string(),
  appearance: z.object({
    summary: z.string(),
    hair: z.string(),
    eyes: z.string(),
    build: z.string(),
    distinctiveFeatures: z.array(z.string()),
  }),
  outfits: z.array(MANGA_OUTFIT_SCHEMA),
  bodyLanguage: z.array(z.string()),
  personality: z.array(z.string()),
  speechStyle: z.array(z.string()),
  goals: z.array(z.string()),
  fears: z.array(z.string()),
  relationships: z.array(MANGA_RELATIONSHIP_SCHEMA),
  roleplayNotes: z.array(z.string()),
  uncertainties: z.array(z.string()),
  sourcePages: PAGE_REFERENCES_SCHEMA,
  confidence: z.number().min(0).max(1),
});

const MANGA_SCENE_SCHEMA = z.object({
  order: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  pages: PAGE_REFERENCES_SCHEMA,
  characters: z.array(z.string()),
  emotionalBeat: z.string(),
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string()),
});

const MANGA_TIMELINE_EVENT_SCHEMA = z.object({
  order: z.number().int().positive(),
  event: z.string(),
  pages: PAGE_REFERENCES_SCHEMA,
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string()),
});

export const MANGA_SYNTHESIS_V1_SCHEMA = z.object({
  folderName: z.string().min(1),
  title: z.string(),
  sourcePages: PAGE_REFERENCES_SCHEMA,
  premise: z.string(),
  storyRetelling: z.string(),
  scenes: z.array(MANGA_SCENE_SCHEMA),
  timeline: z.array(MANGA_TIMELINE_EVENT_SCHEMA),
  characters: z.array(MANGA_SYNTHESIS_CHARACTER_SCHEMA),
  world: z.object({
    settingSummary: z.string(),
    locations: z.array(z.string()),
    socialRules: z.array(z.string()),
    worldRules: z.array(z.string()),
    importantObjects: z.array(z.string()),
    tone: z.array(z.string()),
    genre: z.array(z.string()),
    timeline: z.array(MANGA_TIMELINE_EVENT_SCHEMA),
    currentState: z.string(),
    scenarioHooks: z.array(z.string()),
    continuityConstraints: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  continuityNotes: z.array(z.string()),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const MANGA_BOUNDING_BOX_SCHEMA = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

const MANGA_EXTRACTED_TEXT_ITEM_SCHEMA = z.object({
  order: z.number().int().positive(),
  text: z.string(),
  kind: z.enum(['dialogue', 'narration', 'sfx', 'sign', 'background', 'unknown']),
  speaker: z.string().nullable().optional(),
  region: MANGA_BOUNDING_BOX_SCHEMA.optional(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['ocr', 'vision', 'merged']),
  needsReview: z.boolean(),
  notes: z.array(z.string()).optional(),
});

const MANGA_VISUAL_OBSERVATIONS_SCHEMA = z.object({
  setting: z.string(),
  surroundings: z.string().optional(),
  characters: z.array(
    z.object({
      label: z.string(),
      appearance: z.string().optional(),
      clothing: z.string().optional(),
      expression: z.string().optional(),
      action: z.string().optional(),
    }),
  ),
  cameraNotes: z.string().optional(),
});

const MANGA_PAGE_EXTRACTION_SCHEMA = z.object({
  pageNumber: z.number().int().positive(),
  sourceImage: z.string(),
  dialogue: z.array(MANGA_EXTRACTED_TEXT_ITEM_SCHEMA),
  narration: z.array(MANGA_EXTRACTED_TEXT_ITEM_SCHEMA),
  sfxAndSigns: z.array(MANGA_EXTRACTED_TEXT_ITEM_SCHEMA),
  pageSummary: z.object({
    text: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  visualObservations: MANGA_VISUAL_OBSERVATIONS_SCHEMA.optional(),
  warnings: z.array(z.string()),
  needsReview: z.boolean(),
});

export const MANGA_EXTRACTION_V1_SCHEMA = z.object({
  folderName: z.string().min(1),
  sourceFolder: z.string(),
  pages: z.array(MANGA_PAGE_EXTRACTION_SCHEMA),
  warnings: z.array(z.string()),
  needsReview: z.boolean(),
});

export const MANGA_OVERVIEW_V1_SCHEMA = z.object({
  folderName: z.string().min(1),
  overview: z.string(),
  majorEvents: z.array(z.string()),
  charactersMentioned: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const MANGA_RUN_MANIFEST_V1_SCHEMA = z
  .object({
    version: MANGA_SYNTHESIS_ARTIFACT_VERSION_SCHEMA,
    folderName: z.string().min(1),
    sourceFolder: z.string().min(1),
    pageCount: z.number().int().nonnegative(),
    pagesNeedingReview: z.number().int().nonnegative(),
    stages: z.object({
      extraction: MANGA_RUN_STAGE_STATUS_SCHEMA,
      cleanTranscript: MANGA_RUN_STAGE_STATUS_SCHEMA,
      overview: MANGA_RUN_STAGE_STATUS_SCHEMA,
      synthesis: MANGA_RUN_STAGE_STATUS_SCHEMA,
      guidanceAssessment: MANGA_RUN_STAGE_STATUS_SCHEMA,
    }),
    artifacts: z.array(z.string().min(1)),
    guidance: z.object({
      present: z.boolean(),
      digest: z.string().optional(),
      fileName: z.string().optional(),
    }),
    warnings: z.array(z.string()),
  })
  .strict();

export type iMangaSynthesisV1 = z.infer<typeof MANGA_SYNTHESIS_V1_SCHEMA>;
export type iMangaSynthesisCharacter = z.infer<typeof MANGA_SYNTHESIS_CHARACTER_SCHEMA>;
export type iMangaRunManifestV1 = z.infer<typeof MANGA_RUN_MANIFEST_V1_SCHEMA>;
export type iMangaExtractionV1 = z.infer<typeof MANGA_EXTRACTION_V1_SCHEMA>;
export type iMangaPageExtraction = z.infer<typeof MANGA_PAGE_EXTRACTION_SCHEMA>;
export type iMangaOverviewV1 = z.infer<typeof MANGA_OVERVIEW_V1_SCHEMA>;

export interface iParsedMangaSynthesisArtifact {
  format: (typeof MANGA_SYNTHESIS_ARTIFACT_FORMATS)['manga-to-text.synthesis'];
  version: typeof MANGA_SYNTHESIS_ARTIFACT_VERSION;
  sourceFileName: string;
  synthesis: iMangaSynthesisV1;
  runManifest: iMangaRunManifestV1 | null;
  extraction: iMangaExtractionV1 | null;
  overview: iMangaOverviewV1 | null;
  importWarnings: string[];
}

function parseJson(jsonText: string, artifactLabel: string): unknown {
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    throw new Error(`${artifactLabel} is not valid JSON.`);
  }
}

function formatValidationError(error: z.ZodError, artifactLabel: string) {
  const firstIssue = error.issues[0];
  const issuePath = firstIssue?.path.length ? ` at ${firstIssue.path.join('.')}` : '';
  const issueMessage = firstIssue?.message ? `: ${firstIssue.message}` : '';
  return `${artifactLabel} does not match manga-to-text format v1${issuePath}${issueMessage}.`;
}

function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, artifactLabel: string): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new Error(formatValidationError(result.error, artifactLabel));
  }

  return result.data;
}

export function parseMangaRunManifestJson(jsonText: string): iMangaRunManifestV1 {
  return parseWithSchema(MANGA_RUN_MANIFEST_V1_SCHEMA, parseJson(jsonText, 'run-manifest.json'), 'run-manifest.json');
}

export function parseMangaSynthesisJson(
  jsonText: string,
  sourceFileName = 'synthesis.json',
): iParsedMangaSynthesisArtifact {
  const parsedJson = parseJson(jsonText, sourceFileName);
  const synthesis = parseWithSchema(MANGA_SYNTHESIS_V1_SCHEMA, parsedJson, sourceFileName);
  const importWarnings =
    sourceFileName.toLowerCase() === 'synthesis.json'
      ? []
      : [`Imported ${sourceFileName} as manga-to-text synthesis format v1.`];

  return {
    format: MANGA_SYNTHESIS_ARTIFACT_FORMATS['manga-to-text.synthesis'],
    version: MANGA_SYNTHESIS_ARTIFACT_VERSION,
    sourceFileName,
    synthesis,
    runManifest: null,
    extraction: null,
    overview: null,
    importWarnings,
  };
}

export function parseMangaExtractionJson(jsonText: string): iMangaExtractionV1 {
  return parseWithSchema(MANGA_EXTRACTION_V1_SCHEMA, parseJson(jsonText, 'extraction.json'), 'extraction.json');
}

export function parseMangaOverviewJson(jsonText: string): iMangaOverviewV1 {
  return parseWithSchema(MANGA_OVERVIEW_V1_SCHEMA, parseJson(jsonText, 'overview.json'), 'overview.json');
}

export function attachMangaRunManifest(
  artifact: iParsedMangaSynthesisArtifact,
  runManifest: iMangaRunManifestV1,
): iParsedMangaSynthesisArtifact {
  if (artifact.synthesis.folderName !== runManifest.folderName) {
    throw new Error(
      `run-manifest.json belongs to ${runManifest.folderName}, but synthesis.json belongs to ${artifact.synthesis.folderName}.`,
    );
  }

  return {
    ...artifact,
    runManifest,
  };
}

export function attachMangaExtraction(
  artifact: iParsedMangaSynthesisArtifact,
  extraction: iMangaExtractionV1,
): iParsedMangaSynthesisArtifact {
  if (artifact.synthesis.folderName !== extraction.folderName) {
    throw new Error(
      `extraction.json belongs to ${extraction.folderName}, but synthesis.json belongs to ${artifact.synthesis.folderName}.`,
    );
  }

  return {
    ...artifact,
    extraction,
  };
}

export function attachMangaOverview(
  artifact: iParsedMangaSynthesisArtifact,
  overview: iMangaOverviewV1,
): iParsedMangaSynthesisArtifact {
  if (artifact.synthesis.folderName !== overview.folderName) {
    throw new Error(
      `overview.json belongs to ${overview.folderName}, but synthesis.json belongs to ${artifact.synthesis.folderName}.`,
    );
  }

  return {
    ...artifact,
    overview,
  };
}
