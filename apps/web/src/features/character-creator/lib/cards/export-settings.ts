import { em } from 'enumwaii';
import { z } from 'zod';

import { MEDIA_TYPES } from '@~/lib/media-type-enums';

export const EXPORT_DETAIL_LEVEL_ENUM = em({
  MINIMAL: 'minimal',
  TENZO_METADATA: 'tenzo_metadata',
  FULL: 'full',
});
export const EXPORT_DETAIL_LEVELS = EXPORT_DETAIL_LEVEL_ENUM.enum;
export const EXPORT_DETAIL_LEVEL_SCHEMA = z.enum(EXPORT_DETAIL_LEVELS);

export type ExportDetailLevel = z.infer<typeof EXPORT_DETAIL_LEVEL_SCHEMA>;

export const EXPORT_DETAIL_LEVEL_LABELS = EXPORT_DETAIL_LEVEL_ENUM.derive<string>()(
  [EXPORT_DETAIL_LEVELS.MINIMAL, 'Strictly necessary'],
  [EXPORT_DETAIL_LEVELS.TENZO_METADATA, 'With Tenzo metadata'],
  [EXPORT_DETAIL_LEVELS.FULL, 'Full export'],
);

export const EXPORT_DETAIL_LEVEL_DESCRIPTIONS = EXPORT_DETAIL_LEVEL_ENUM.derive<string>()(
  [EXPORT_DETAIL_LEVELS.MINIMAL, 'Only official Character Card V2 fields. Tenzo-specific data is stripped.'],
  [
    EXPORT_DETAIL_LEVELS.TENZO_METADATA,
    'Adds custom fields, portrait crop, and the general character idea. Per-field generation guidance is excluded.',
  ],
  [EXPORT_DETAIL_LEVELS.FULL, 'Everything, including per-field AI generation guidance.'],
);

export const ARCHIVE_FORMAT_ENUM = em({
  ZIP: 'zip',
  TAR_GZ: 'tar_gz',
});
export const ARCHIVE_FORMATS = ARCHIVE_FORMAT_ENUM.enum;
export const ARCHIVE_FORMAT_SCHEMA = z.enum(ARCHIVE_FORMATS);

export type ArchiveFormat = z.infer<typeof ARCHIVE_FORMAT_SCHEMA>;

export const ARCHIVE_FORMAT_LABELS = ARCHIVE_FORMAT_ENUM.derive<string>()(
  [ARCHIVE_FORMATS.ZIP, 'ZIP (.zip)'],
  [ARCHIVE_FORMATS.TAR_GZ, 'Tarball (.tar.gz)'],
);

export const ARCHIVE_FORMAT_FILE_EXTENSIONS = ARCHIVE_FORMAT_ENUM.derive<string>()(
  [ARCHIVE_FORMATS.ZIP, '.zip'],
  [ARCHIVE_FORMATS.TAR_GZ, '.tar.gz'],
);

export const ARCHIVE_FORMAT_MIME_TYPES = ARCHIVE_FORMAT_ENUM.derive<string>()(
  [ARCHIVE_FORMATS.ZIP, MEDIA_TYPES.ZIP],
  [ARCHIVE_FORMATS.TAR_GZ, MEDIA_TYPES.GZIP],
);

export const EXPORT_SETTINGS_SCHEMA = z.object({
  detailLevel: EXPORT_DETAIL_LEVEL_SCHEMA,
  archiveFormat: ARCHIVE_FORMAT_SCHEMA,
});

export type iExportSettings = z.infer<typeof EXPORT_SETTINGS_SCHEMA>;

export const DEFAULT_EXPORT_SETTINGS: iExportSettings = {
  detailLevel: EXPORT_DETAIL_LEVELS.TENZO_METADATA,
  archiveFormat: ARCHIVE_FORMATS.ZIP,
};

export function sanitizeExportSettings(value: unknown): iExportSettings {
  const parsed = EXPORT_SETTINGS_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_EXPORT_SETTINGS;
}
