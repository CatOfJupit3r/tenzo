import z from 'zod';

export const settingsDialogTabSchema = z.enum(['connection', 'sampling', 'templates', 'examples']);
export const SETTINGS_DIALOG_TABS = settingsDialogTabSchema.enum;
export type SettingsDialogTab = z.infer<typeof settingsDialogTabSchema>;
