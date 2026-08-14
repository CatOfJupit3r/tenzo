import { useCallback, useEffect, useState } from 'react';

import { WORKSPACE_PANEL_WIDTHS, clampWorkspacePanelWidth } from '../components/workspace-panel-layout';

const SECTION_PANEL_WIDTH_STORAGE_KEY = 'tenzo:character-creator:section-panel-width';
const SECTION_PANEL_COLLAPSED_STORAGE_KEY = 'tenzo:character-creator:section-panel-collapsed';
const ASSISTANT_PANEL_WIDTH_STORAGE_KEY = 'tenzo:character-creator:assistant-panel-width';

function readStoredWidth(storageKey: string, fallbackWidth: number, minWidth: number, maxWidth: number) {
  if (typeof window === 'undefined') {
    return fallbackWidth;
  }

  const storedWidth = Number.parseFloat(window.localStorage.getItem(storageKey) ?? '');
  return Number.isFinite(storedWidth) ? clampWorkspacePanelWidth(storedWidth, minWidth, maxWidth) : fallbackWidth;
}

function readStoredCollapsedState() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(SECTION_PANEL_COLLAPSED_STORAGE_KEY) === 'true';
}

export function useWorkspacePanelLayout() {
  const [storedSectionPanelWidth, setStoredSectionPanelWidth] = useState(() =>
    readStoredWidth(
      SECTION_PANEL_WIDTH_STORAGE_KEY,
      WORKSPACE_PANEL_WIDTHS.section.default,
      WORKSPACE_PANEL_WIDTHS.section.min,
      WORKSPACE_PANEL_WIDTHS.section.max,
    ),
  );
  const [storedAssistantPanelWidth, setStoredAssistantPanelWidth] = useState(() =>
    readStoredWidth(
      ASSISTANT_PANEL_WIDTH_STORAGE_KEY,
      WORKSPACE_PANEL_WIDTHS.assistant.default,
      WORKSPACE_PANEL_WIDTHS.assistant.min,
      WORKSPACE_PANEL_WIDTHS.assistant.max,
    ),
  );
  const [isSectionPanelCollapsed, setIsSectionPanelCollapsed] = useState(readStoredCollapsedState);

  const setSectionPanelWidth = useCallback((width: number) => {
    setStoredSectionPanelWidth(
      clampWorkspacePanelWidth(width, WORKSPACE_PANEL_WIDTHS.section.min, WORKSPACE_PANEL_WIDTHS.section.max),
    );
  }, []);

  const setAssistantPanelWidth = useCallback((width: number) => {
    setStoredAssistantPanelWidth(
      clampWorkspacePanelWidth(width, WORKSPACE_PANEL_WIDTHS.assistant.min, WORKSPACE_PANEL_WIDTHS.assistant.max),
    );
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SECTION_PANEL_WIDTH_STORAGE_KEY, String(storedSectionPanelWidth));
  }, [storedSectionPanelWidth]);

  useEffect(() => {
    window.localStorage.setItem(ASSISTANT_PANEL_WIDTH_STORAGE_KEY, String(storedAssistantPanelWidth));
  }, [storedAssistantPanelWidth]);

  useEffect(() => {
    window.localStorage.setItem(SECTION_PANEL_COLLAPSED_STORAGE_KEY, String(isSectionPanelCollapsed));
  }, [isSectionPanelCollapsed]);

  return {
    assistantPanelWidth: storedAssistantPanelWidth,
    isSectionPanelCollapsed,
    sectionPanelWidth: storedSectionPanelWidth,
    setAssistantPanelWidth,
    setIsSectionPanelCollapsed,
    setSectionPanelWidth,
  };
}
