export const WORKSPACE_PANEL_WIDTHS = {
  section: {
    default: 216,
    min: 176,
    max: 320,
    collapsed: 64,
  },
  assistant: {
    default: 400,
    min: 320,
    max: 560,
  },
} as const;

export function clampWorkspacePanelWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(Math.max(width, minWidth), maxWidth);
}
