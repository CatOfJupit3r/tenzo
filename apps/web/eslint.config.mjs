import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWebConfig } from '@startername/eslint-config';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);
const tailwindConfigPath = path.join(currentDirname, 'src', 'index.css');

const baseConfig = await createWebConfig({
  rootDir: import.meta.url,
  tailwindConfigPath,
  additionalIgnores: ['./src/routeTree.gen.ts', 'vite.config.ts', 'vitest.config.ts', '**/*.css'],
});

const externalEnumContracts = {
  GENERATION_ABORT_CODE_ENUM: 'The AI stream abort code is part of its existing wire protocol.',
  ABORT_ERROR_NAME_ENUM: 'DOM and transport libraries expose these exact error names.',
  KEYBOARD_KEY_ENUM: 'KeyboardEvent.key uses these browser-defined values.',
  MEDIA_TYPE_ENUM: 'IANA media types have fixed wire spellings.',
  ASSET_FILE_EXTENSION_ENUM: 'Exported backup asset paths use standard file extensions.',
  OPENAI_CAPABILITY_PARAMETER_ENUM: 'OpenAI-compatible capability metadata names these wire parameters.',
  userThemeEnum: 'Existing theme cookies and Tailwind dark-mode classes use these values.',
  LOG_LEVEL_ENUM: 'tslog level names and logger method keys use these values.',
  MODEL_SETTING_KEYS_ENUM: 'These keys select fields in the stored connection settings contract.',
  CHARACTER_ASSISTANT_TOOL_NAME_ENUM: 'Existing assistant messages and model tool calls use these published names.',
  BACKUP_FILE_PATHS_ENUM: 'Exported backup archives use these fixed member paths.',
  CHARACTER_CARD_SPEC_ENUM: 'Character Card V2 specifies the exact spec identifier.',
  CHARACTER_CARD_SPEC_VERSION_ENUM: 'Character Card V2 specifies this version literal.',
  CHARACTER_BOOK_ENTRY_POSITION_ENUM: 'Character Card V2 specifies these lorebook positions.',
  CHARACTER_CHUNK_KEYWORD_ENUM: 'Character PNG metadata uses these published tEXt keywords.',
  PNG_CHUNK_TYPE_ENUM: 'The PNG format defines these chunk identifiers.',
  TEXT_FILE_EXTENSION_ENUM: 'File extension detection uses these standard suffixes.',
  EDITOR_CONTENT_TYPE_ENUM: 'Tiptap requires these content-type identifiers.',
  EDITOR_NODE_TYPE_ENUM: 'Tiptap documents store these exact node type names.',
  EDITOR_MARK_TYPE_ENUM: 'Tiptap documents store these exact mark names.',
  macroKindEnum: 'Character card macros use these established names.',
  STREAM_MESSAGE_ROLE_ENUM: 'TanStack AI and chat provider protocols use these message roles.',
  STREAM_TOOL_STATE_ENUM: 'TanStack AI streaming tool events use this state.',
  MESSAGE_PART_TYPE_ENUM: 'TanStack AI UIMessage parts require these tags.',
  CONTENT_SOURCE_TYPE_ENUM: 'TanStack AI media sources require these tags.',
  TOOL_CALL_STATE_ENUM: 'TanStack AI tool-call parts require these states.',
  MESSAGE_PART_STATUS_ENUM: 'TanStack AI result parts require these status strings.',
  ALERT_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  BADGE_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  CROPPER_OBJECT_FITS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  CROPPER_SHAPES_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  DROPDOWN_MENU_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  EMPTY_MEDIA_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  FIELD_LEGEND_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  FIELD_ORIENTATIONS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  ITEM_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  ITEM_SIZES_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  ITEM_MEDIA_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  MESSAGE_ALIGNMENTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  TOGGLE_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  TOGGLE_SIZES_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  BUTTON_VARIANTS_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  BUTTON_SIZES_ENUM: 'Existing UI component props and CSS attribute selectors use these variant values.',
  CHARACTER_FIELD_KEY_ENUM:
    'Character Card V2 fields and established template binding keys must retain their stored spellings.',
  ERROR_DETAIL_KEY_ENUM: 'Provider errors expose these exact detail and nested-cause property names.',
  ERROR_CHILD_KEY_ENUM: 'Provider errors expose these exact detail and nested-cause property names.',
};

const persistedEnumContracts = {
  CHARACTER_ASSISTANT_FOCUS_KIND_ENUM: 'Saved assistant focus payloads and API requests use these values.',
  CHARACTER_ASSISTANT_ATTACHMENT_KINDS_ENUM: 'Stored assistant context attachments use this kind.',
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_ENUM: 'Saved discovery tool outputs use these categories.',
  IMPORTED_CARD_SOURCE_KIND_ENUM: 'Stored example characters and exported backup records use these source kinds.',
  EXPORT_DETAIL_LEVEL_ENUM: 'Persisted export settings use these detail levels.',
  ARCHIVE_FORMAT_ENUM: 'Persisted export settings use these archive formats.',
  TEMPLATE_MODE_ENUM: 'Stored field templates and exported backups use these modes.',
  FIELD_TEMPLATE_SELECTION_ENUM: 'Stored field-template bindings use this explicit selection sentinel.',
  OUTPUT_FORMAT_ENUM: 'Stored connection settings use these output formats.',
  REQUEST_MODE_ENUM: 'Stored connection settings use these request modes.',
  GENERATION_PROVIDER_ENUM: 'Stored connection settings use these provider identifiers.',
  FIELD_WRITING_STRATEGY_ENUM: 'Stored connection settings use these writing strategies.',
  AGENT_GENERATION_BUDGET_ENUM: 'Stored connection settings use these generation budgets.',
  CHARACTER_EDIT_PATCH_KINDS_ENUM: 'Saved assistant proposals and exported backups use these patch tags.',
};

const enumContractExceptions = [
  ...Object.entries(externalEnumContracts).map(([name, justification]) => ({
    name: { regex: '^' + name + '$' },
    reason: 'external-contract',
    justification,
  })),
  ...Object.entries(persistedEnumContracts).map(([name, justification]) => ({
    name: { regex: '^' + name + '$' },
    reason: 'compatibility',
    justification,
  })),
];

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'enumwaii/no-object-em': ['error', { ignore: enumContractExceptions }],
      'enumwaii/enforce-enum-casing': [
        'error',
        { ignoredNamePatterns: [...Object.keys(externalEnumContracts), ...Object.keys(persistedEnumContracts)] },
      ],
    },
  },
];
