import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CHARACTER_GENERATION_SETTINGS,
  GENERATION_PROVIDERS,
  GENERATION_PROVIDER_DEFAULTS,
  OUTPUT_FORMATS,
} from '../lib/generation/generation-config';
import { FIELD_WRITING_STRATEGIES } from '../lib/orchestration/field-writing-strategy';
import { AGENT_GENERATION_BUDGETS } from '../lib/provider/agent-generation-budget';
import { ConnectionSettings } from './connection-settings';

describe('ConnectionSettings enum selections', () => {
  it.each([
    {
      label: 'Provider',
      option: 'OpenRouter',
      expected: {
        provider: GENERATION_PROVIDERS.OPENROUTER,
        ...GENERATION_PROVIDER_DEFAULTS.get(GENERATION_PROVIDERS.OPENROUTER),
      },
    },
    { label: 'Output format', option: 'Raw text', expected: { outputFormat: OUTPUT_FORMATS.NONE } },
    {
      label: 'Generation budget',
      option: 'Economy',
      expected: { agentGenerationBudget: AGENT_GENERATION_BUDGETS.ECONOMY },
    },
    {
      label: 'Field writing',
      option: 'One combined call',
      expected: { fieldWritingStrategy: FIELD_WRITING_STRATEGIES.COMBINED_FIELDS },
    },
  ])('applies the selected $label value', async ({ label, option, expected }) => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(
      <ConnectionSettings
        generationSettings={DEFAULT_CHARACTER_GENERATION_SETTINGS}
        apiKey=""
        connectionHealth={{
          isChecking: false,
          hasCompletedCheck: false,
          errorMessage: null,
          providerName: null,
          providerKind: null,
          availableModels: [],
          detectedModel: null,
          detectedContextSize: null,
          modelContextSizes: {},
          modelCapabilities: {},
          modelProviders: [],
          policyCatalog: null,
        }}
        onApiKeyChange={vi.fn()}
        onHealthCheck={async () => {}}
        onSettingsChange={onSettingsChange}
      />,
    );
    await user.type(await screen.findByRole('combobox', { name: label }), option);
    await user.keyboard('{Enter}');
    expect(onSettingsChange).toHaveBeenCalledWith(expected);
  });
});
