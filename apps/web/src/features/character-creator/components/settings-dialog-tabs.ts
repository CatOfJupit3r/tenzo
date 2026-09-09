import { em } from 'enumwaii';
import z from 'zod';

export const settingsDialogTabEnum = em(['CONNECTION', 'SAMPLING', 'ASSISTANT', 'TEMPLATES', 'EXAMPLES']);
export const SETTINGS_DIALOG_TABS = settingsDialogTabEnum.enum;
export const settingsDialogTabSchema = z.enum(SETTINGS_DIALOG_TABS);

export type SettingsDialogTab = z.infer<typeof settingsDialogTabSchema>;
