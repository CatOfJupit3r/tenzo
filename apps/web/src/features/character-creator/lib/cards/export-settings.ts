import { z } from 'zod';

export const EXPORT_DETAIL_LEVEL_SCHEMA = z.enum(['minimal', 'tenzo_metadata', 'full']);
export const EXPORT_DETAIL_LEVELS = EXPORT_DETAIL_LEVEL_SCHEMA.enum;
export type ExportDetailLevel = z.infer<typeof EXPORT_DETAIL_LEVEL_SCHEMA>;

export const EXPORT_DETAIL_LEVEL_LABELS = {
  [EXPORT_DETAIL_LEVELS.minimal]: 'Strictly necessary',
  [EXPORT_DETAIL_LEVELS.tenzo_metadata]: 'With Tenzo metadata',
  [EXPORT_DETAIL_LEVELS.full]: 'Full export',
} satisfies Record<ExportDetailLevel, string>;

export const EXPORT_DETAIL_LEVEL_DESCRIPTIONS = {
  [EXPORT_DETAIL_LEVELS.minimal]: 'Only official Character Card V2 fields. Tenzo-specific data is stripped.',
  [EXPORT_DETAIL_LEVELS.tenzo_metadata]:
    'Adds custom fields, portrait crop, and the general character idea. Per-field generation guidance is excluded.',
  [EXPORT_DETAIL_LEVELS.full]: 'Everything, including per-field AI generation guidance.',
} satisfies Record<ExportDetailLevel, string>;

export const ARCHIVE_FORMAT_SCHEMA = z.enum(['zip', 'tar_gz']);
export const ARCHIVE_FORMATS = ARCHIVE_FORMAT_SCHEMA.enum;
export type ArchiveFormat = z.infer<typeof ARCHIVE_FORMAT_SCHEMA>;

export const ARCHIVE_FORMAT_LABELS = {
  [ARCHIVE_FORMATS.zip]: 'ZIP (.zip)',
  [ARCHIVE_FORMATS.tar_gz]: 'Tarball (.tar.gz)',
} satisfies Record<ArchiveFormat, string>;

export const ARCHIVE_FORMAT_FILE_EXTENSIONS = {
  [ARCHIVE_FORMATS.zip]: '.zip',
  [ARCHIVE_FORMATS.tar_gz]: '.tar.gz',
} satisfies Record<ArchiveFormat, string>;

export const ARCHIVE_FORMAT_MIME_TYPES = {
  [ARCHIVE_FORMATS.zip]: 'application/zip',
  [ARCHIVE_FORMATS.tar_gz]: 'application/gzip',
} satisfies Record<ArchiveFormat, string>;

export const EXPORT_SETTINGS_SCHEMA = z.object({
  detailLevel: EXPORT_DETAIL_LEVEL_SCHEMA,
  archiveFormat: ARCHIVE_FORMAT_SCHEMA,
});

export type iExportSettings = z.infer<typeof EXPORT_SETTINGS_SCHEMA>;

export const DEFAULT_EXPORT_SETTINGS: iExportSettings = {
  detailLevel: EXPORT_DETAIL_LEVELS.tenzo_metadata,
  archiveFormat: ARCHIVE_FORMATS.zip,
};

export function sanitizeExportSettings(value: unknown): iExportSettings {
  const parsed = EXPORT_SETTINGS_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_EXPORT_SETTINGS;
}
