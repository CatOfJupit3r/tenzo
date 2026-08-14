import { LuActivity, LuLoaderCircle } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { SingleSelect } from '@~/components/ui/select';
import type { iOptionType } from '@~/components/ui/select';
import { Switch } from '@~/components/ui/switch';
import { cn } from '@~/lib/utils';

import { CHARACTER_ASSISTANT_GENERATION_MODES } from '../lib/character-assistant-generation-mode';
import {
  GENERATION_PROVIDER_DEFAULTS,
  GENERATION_PROVIDERS,
  OUTPUT_FORMATS,
  REQUEST_MODES,
} from '../lib/generation-config';
import type { iCharacterGenerationSettings } from '../lib/generation-config';
import type { ProviderKind } from '../lib/provider-health';
import type { iGenerationSettingsPatchHandler } from './generation-settings-contracts';

export interface iConnectionHealthViewModel {
  isChecking: boolean;
  errorMessage: string | null;
  providerName: string | null;
  providerKind: ProviderKind | null;
  availableModels: string[];
  detectedModel: string | null;
  detectedContextSize: number | null;
}

const outputFormatOptions: iOptionType[] = [
  {
    label: 'XML wrapper',
    value: OUTPUT_FORMATS.xml,
    description: 'Most reliable for smaller models and partial continue parsing.',
  },
  {
    label: 'JSON wrapper',
    value: OUTPUT_FORMATS.json,
    description: 'Useful when the provider follows JSON instructions consistently.',
  },
  {
    label: 'Raw text',
    value: OUTPUT_FORMATS.none,
    description: 'Fastest, but the least structured when models drift.',
  },
];

const providerOptions: iOptionType[] = [
  {
    label: 'KoboldCpp',
    value: GENERATION_PROVIDERS.koboldcpp,
    description: 'Connect to a local KoboldCpp OpenAI-compatible endpoint.',
  },
  {
    label: 'OpenRouter',
    value: GENERATION_PROVIDERS.openrouter,
    description: 'Use an OpenRouter API key and model ID through TanStack AI.',
  },
];

const assistantGenerationModeOptions: iOptionType[] = [
  {
    label: 'Compatible guided chat',
    value: CHARACTER_ASSISTANT_GENERATION_MODES['structured-output'],
    description: 'Chat normally with any model, then synthesize reviewable edits when the step is ready.',
  },
  {
    label: 'Tool calls',
    value: CHARACTER_ASSISTANT_GENERATION_MODES['tool-call'],
    description: 'Multi-step agent tools for models with reliable native function calling.',
  },
];

export interface iConnectionSettingsProps {
  generationSettings: iCharacterGenerationSettings;
  apiKey: string;
  connectionHealth: iConnectionHealthViewModel;
  onApiKeyChange: (value: string) => void;
  onHealthCheck: () => Promise<void>;
  onSettingsChange: iGenerationSettingsPatchHandler;
}

export function ConnectionSettings({
  generationSettings,
  apiKey,
  connectionHealth,
  onApiKeyChange,
  onHealthCheck,
  onSettingsChange,
}: iConnectionSettingsProps) {
  const isUsingProxy = generationSettings.requestMode === REQUEST_MODES.proxy;
  const isUsingOpenRouter = generationSettings.provider === GENERATION_PROVIDERS.openrouter;
  const hasDetectedModels = connectionHealth.availableModels.length > 0;
  const modelHelperText = hasDetectedModels
    ? `Detected models: ${connectionHealth.availableModels.join(', ')}`
    : 'Run health check to infer available models from the endpoint.';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="api-provider">Provider</Label>
          <SingleSelect
            inputId="api-provider"
            options={providerOptions}
            value={generationSettings.provider}
            onValueChange={(value) => {
              if (value && GENERATION_PROVIDERS[value as keyof typeof GENERATION_PROVIDERS]) {
                const provider = value as iCharacterGenerationSettings['provider'];
                onSettingsChange({ provider, ...GENERATION_PROVIDER_DEFAULTS[provider] });
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-endpoint">Endpoint</Label>
          <Input
            disabled={isUsingOpenRouter}
            id="api-endpoint"
            placeholder="http://localhost:5001"
            value={generationSettings.endpoint}
            onChange={(event) => onSettingsChange({ endpoint: event.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            {isUsingOpenRouter
              ? 'Managed by OpenRouter with zero-retention and data-collection-denied routing.'
              : 'Use the KoboldCpp server base URL.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-model">Model</Label>
          <Input
            id="api-model"
            placeholder={isUsingOpenRouter ? 'anthropic/claude-sonnet-4' : 'local-model'}
            value={generationSettings.model}
            onChange={(event) => onSettingsChange({ model: event.target.value })}
          />
          <p className="text-sm text-muted-foreground">{modelHelperText}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vision-model">Vision model</Label>
          <Input
            id="vision-model"
            placeholder="Same as the main model"
            value={generationSettings.visionModel}
            onChange={(event) => onSettingsChange({ visionModel: event.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            Optional. Used for reference-image analysis during guided setup.
          </p>
        </div>

        <div className="flex items-end">
          <Button
            aria-label="Run endpoint health check"
            className="w-full"
            disabled={connectionHealth.isChecking}
            type="button"
            variant="outline"
            onClick={() => {
              onHealthCheck().catch(() => undefined);
            }}
          >
            {connectionHealth.isChecking ? (
              <LuLoaderCircle className="size-4 animate-spin" />
            ) : (
              <LuActivity className="size-4" />
            )}
            {connectionHealth.isChecking ? 'Checking endpoint...' : 'Run health check'}
          </Button>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="api-key">API key</Label>
          <Input
            id="api-key"
            type="password"
            placeholder={isUsingOpenRouter ? 'sk-or-v1-...' : 'Optional for local KoboldCpp'}
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Saved locally in an obfuscated form only. Treat this browser profile as trusted.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="output-format">Output format</Label>
          <SingleSelect
            inputId="output-format"
            options={outputFormatOptions}
            value={generationSettings.outputFormat}
            onValueChange={(value) => {
              if (value) {
                onSettingsChange({ outputFormat: value as iCharacterGenerationSettings['outputFormat'] });
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assistant-generation-mode">Character assistant mode</Label>
          <SingleSelect
            inputId="assistant-generation-mode"
            options={assistantGenerationModeOptions}
            value={generationSettings.assistantGenerationMode}
            onValueChange={(value) => {
              if (value) {
                onSettingsChange({
                  assistantGenerationMode: value as iCharacterGenerationSettings['assistantGenerationMode'],
                });
              }
            }}
          />
          <p className="text-sm text-muted-foreground">
            Compatible guided chat works without native tools. Tool calls expose native agent behavior for models that
            support it reliably.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2 md:self-end">
          <div className="space-y-1">
            <p className="text-sm font-medium">Use server proxy</p>
            <p className="text-sm text-muted-foreground">Recommended for providers that block browser CORS requests.</p>
          </div>
          <Switch
            checked={isUsingProxy}
            onCheckedChange={(checked) =>
              onSettingsChange({ requestMode: checked ? REQUEST_MODES.proxy : REQUEST_MODES.browser })
            }
            aria-label="Use server proxy"
          />
        </div>
      </div>

      {connectionHealth.errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Health check failed</AlertTitle>
          <AlertDescription>{connectionHealth.errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {connectionHealth.providerName || connectionHealth.detectedContextSize || connectionHealth.detectedModel ? (
        <Alert>
          <AlertTitle>Detected endpoint capabilities</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              Provider:{' '}
              <span
                className={cn(
                  'font-medium',
                  connectionHealth.providerKind === 'koboldcpp' ? 'text-foreground' : undefined,
                )}
              >
                {connectionHealth.providerName ?? 'Unknown provider'}
              </span>
            </p>
            {connectionHealth.detectedModel ? <p>Selected model: {connectionHealth.detectedModel}</p> : null}
            {connectionHealth.detectedContextSize ? (
              <p>Detected context size: {connectionHealth.detectedContextSize}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert>
        <AlertTitle>Key handling</AlertTitle>
        <AlertDescription>
          Proxy mode sends the key per request through the TanStack Start server function and does not persist it
          server-side. Browser mode keeps the request entirely client-side, but only works for CORS-friendly endpoints.
          OpenRouter requests require a zero-data-retention endpoint and deny provider data collection; requests fail
          when the selected model has no compliant endpoint.
        </AlertDescription>
      </Alert>
    </div>
  );
}
