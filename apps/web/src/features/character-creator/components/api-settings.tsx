import { LuActivity, LuLoaderCircle } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { SingleSelect } from '@~/components/ui/select';
import type { iOptionType } from '@~/components/ui/select';
import { Switch } from '@~/components/ui/switch';
import { cn } from '@~/lib/utils';

import {
  FREQUENCY_PENALTY_RANGE,
  MIN_P_RANGE,
  OUTPUT_FORMATS,
  PRESENCE_PENALTY_RANGE,
  REQUEST_MODES,
  TEMPERATURE_RANGE,
  TOP_K_RANGE,
  TOP_P_RANGE,
} from '../lib/generation-config';
import type { iCharacterGenerationSettings } from '../lib/generation-config';

export interface iConnectionHealthViewModel {
  isChecking: boolean;
  errorMessage: string | null;
  providerName: string | null;
  providerKind: 'koboldcpp' | 'openai-compatible' | 'unknown' | null;
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

export interface iApiSettingsProps {
  generationSettings: iCharacterGenerationSettings;
  apiKey: string;
  connectionHealth: iConnectionHealthViewModel;
  onApiKeyChange: (value: string) => void;
  onHealthCheck: () => Promise<void>;
  onSettingsChange: (
    patch: Partial<
      Omit<
        iCharacterGenerationSettings,
        'apiKeyCiphertext' | 'fieldInstructions' | 'fieldShouldUseGeneralCharacterIdea' | 'generalCharacterIdea'
      >
    >,
  ) => void;
}

export function ApiSettings({
  generationSettings,
  apiKey,
  connectionHealth,
  onApiKeyChange,
  onHealthCheck,
  onSettingsChange,
}: iApiSettingsProps) {
  const isUsingProxy = generationSettings.requestMode === REQUEST_MODES.proxy;
  const hasDetectedModels = connectionHealth.availableModels.length > 0;
  const modelHelperText = hasDetectedModels
    ? `Detected models: ${connectionHealth.availableModels.join(', ')}`
    : 'Run health check to infer available models from the endpoint.';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="api-endpoint">Endpoint</Label>
          <Input
            id="api-endpoint"
            placeholder="https://api.openai.com"
            value={generationSettings.endpoint}
            onChange={(event) => onSettingsChange({ endpoint: event.target.value })}
          />
          <p className="text-sm text-muted-foreground">Use the provider base URL or a full /v1/chat/completions URL.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-model">Model</Label>
          <Input
            id="api-model"
            placeholder="gpt-4.1-mini"
            value={generationSettings.model}
            onChange={(event) => onSettingsChange({ model: event.target.value })}
          />
          <p className="text-sm text-muted-foreground">{modelHelperText}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-max-tokens">Max tokens</Label>
          <Input
            id="api-max-tokens"
            type="number"
            min={1}
            step={1}
            value={String(generationSettings.maxTokens)}
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);
              onSettingsChange({ maxTokens: Number.isNaN(nextValue) ? 1 : nextValue });
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-context-size">Context size</Label>
          <Input
            id="api-context-size"
            type="number"
            min={1}
            step={1}
            value={String(generationSettings.contextSize)}
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);
              onSettingsChange({ contextSize: Number.isNaN(nextValue) ? 1 : nextValue });
            }}
          />
          <p className="text-sm text-muted-foreground">Used to budget how much example context can be sent.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-temperature">Temperature</Label>
          <Input
            id="api-temperature"
            type="number"
            min={TEMPERATURE_RANGE.min}
            max={TEMPERATURE_RANGE.max}
            step={0.1}
            value={String(generationSettings.temperature)}
            onChange={(event) => {
              const nextValue = Number.parseFloat(event.target.value);
              onSettingsChange({
                temperature: Number.isNaN(nextValue)
                  ? TEMPERATURE_RANGE.min
                  : Math.min(TEMPERATURE_RANGE.max, Math.max(TEMPERATURE_RANGE.min, nextValue)),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">Higher values increase randomness in the response.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-top-p">Top P</Label>
          <Input
            id="api-top-p"
            type="number"
            min={TOP_P_RANGE.min}
            max={TOP_P_RANGE.max}
            step={0.05}
            value={String(generationSettings.topP)}
            onChange={(event) => {
              const nextValue = Number.parseFloat(event.target.value);
              onSettingsChange({
                topP: Number.isNaN(nextValue)
                  ? TOP_P_RANGE.max
                  : Math.min(TOP_P_RANGE.max, Math.max(TOP_P_RANGE.min, nextValue)),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">Restricts sampling to the top probability mass.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-frequency-penalty">Frequency penalty</Label>
          <Input
            id="api-frequency-penalty"
            type="number"
            min={FREQUENCY_PENALTY_RANGE.min}
            max={FREQUENCY_PENALTY_RANGE.max}
            step={0.1}
            value={String(generationSettings.frequencyPenalty)}
            onChange={(event) => {
              const nextValue = Number.parseFloat(event.target.value);
              onSettingsChange({
                frequencyPenalty: Number.isNaN(nextValue)
                  ? 0
                  : Math.min(FREQUENCY_PENALTY_RANGE.max, Math.max(FREQUENCY_PENALTY_RANGE.min, nextValue)),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">Penalizes tokens proportionally to how often they recur.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-presence-penalty">Presence penalty</Label>
          <Input
            id="api-presence-penalty"
            type="number"
            min={PRESENCE_PENALTY_RANGE.min}
            max={PRESENCE_PENALTY_RANGE.max}
            step={0.1}
            value={String(generationSettings.presencePenalty)}
            onChange={(event) => {
              const nextValue = Number.parseFloat(event.target.value);
              onSettingsChange({
                presencePenalty: Number.isNaN(nextValue)
                  ? 0
                  : Math.min(PRESENCE_PENALTY_RANGE.max, Math.max(PRESENCE_PENALTY_RANGE.min, nextValue)),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            Penalizes tokens that already appeared at all, encouraging new topics.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-top-k">Top K</Label>
          <Input
            id="api-top-k"
            type="number"
            min={TOP_K_RANGE.min}
            max={TOP_K_RANGE.max}
            step={1}
            value={String(generationSettings.topK)}
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);
              onSettingsChange({
                topK: Number.isNaN(nextValue)
                  ? TOP_K_RANGE.min
                  : Math.min(TOP_K_RANGE.max, Math.max(TOP_K_RANGE.min, nextValue)),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            Only used by koboldcpp/llama.cpp-style backends. 0 leaves the provider default in place; a restrictive
            provider default here is a common cause of low variance regardless of temperature.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-min-p">Min P</Label>
          <Input
            id="api-min-p"
            type="number"
            min={MIN_P_RANGE.min}
            max={MIN_P_RANGE.max}
            step={0.01}
            value={String(generationSettings.minP)}
            onChange={(event) => {
              const nextValue = Number.parseFloat(event.target.value);
              onSettingsChange({
                minP: Number.isNaN(nextValue)
                  ? MIN_P_RANGE.min
                  : Math.min(MIN_P_RANGE.max, Math.max(MIN_P_RANGE.min, nextValue)),
              });
            }}
          />
          <p className="text-sm text-muted-foreground">
            Only used by koboldcpp/llama.cpp-style backends. 0 leaves the provider default in place.
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
            placeholder="sk-..."
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
        </AlertDescription>
      </Alert>
    </div>
  );
}
