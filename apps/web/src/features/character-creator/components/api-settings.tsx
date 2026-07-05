import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { SingleSelect } from '@~/components/ui/select';
import type { iOptionType } from '@~/components/ui/select';
import { Switch } from '@~/components/ui/switch';

import { OUTPUT_FORMATS, REQUEST_MODES } from '../lib/generation-config';
import type { iCharacterGenerationSettings } from '../lib/generation-config';

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
  onApiKeyChange: (value: string) => void;
  onSettingsChange: (
    patch: Partial<Omit<iCharacterGenerationSettings, 'apiKeyCiphertext' | 'fieldInstructions'>>,
  ) => void;
}

export function ApiSettings({ generationSettings, apiKey, onApiKeyChange, onSettingsChange }: iApiSettingsProps) {
  const isUsingProxy = generationSettings.requestMode === REQUEST_MODES.proxy;

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
