import { LuActivity, LuCircleCheck, LuCircleHelp, LuCircleX, LuLoaderCircle } from 'react-icons/lu';

import { Alert, AlertDescription, AlertTitle } from '@~/components/ui/alert';
import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import type { iOptionType } from '@~/components/ui/select';
import { SingleSelect } from '@~/components/ui/select';
import { Switch } from '@~/components/ui/switch';
import { ALERT_VARIANTS, BUTTON_VARIANTS } from '@~/components/ui/ui-enums';
import {
  FIELD_WRITING_STRATEGY_ENUM,
  FIELD_WRITING_STRATEGY_LABELS,
} from '@~/features/character-creator/lib/orchestration/field-writing-strategy';
import {
  AGENT_GENERATION_BUDGET_ENUM,
  AGENT_GENERATION_BUDGET_LABELS,
} from '@~/features/character-creator/lib/provider/agent-generation-budget';
import { cn } from '@~/lib/utils';

import type { iCharacterGenerationSettings } from '../lib/generation/generation-config';
import {
  GENERATION_PROVIDER_DEFAULTS,
  GENERATION_PROVIDER_ENUM,
  GENERATION_PROVIDERS,
  OUTPUT_FORMAT_ENUM,
  OUTPUT_FORMATS,
  REQUEST_MODES,
} from '../lib/generation/generation-config';
import type { iModelCapabilities, iModelProviderOption } from '../lib/provider/model-capabilities';
import {
  getModelCompatibilityStatus,
  getRequiredModelCapabilities,
  hasModelCapability,
  MODEL_CAPABILITIES,
  MODEL_CAPABILITY_ENUM,
  MODEL_COMPATIBILITY_STATUS_ENUM,
  MODEL_COMPATIBILITY_STATUSES,
} from '../lib/provider/model-capabilities';
import type { iProviderModelOption, ProviderKind } from '../lib/provider/provider-health';
import { PROVIDER_KINDS } from '../lib/provider/provider-health';
import type { iProviderPolicyCatalog } from '../lib/provider/provider-policy-resolver';
import type { iGenerationSettingsPatchHandler } from './generation-settings-contracts';

export interface iConnectionHealthViewModel {
  isChecking: boolean;
  hasCompletedCheck: boolean;
  errorMessage: string | null;
  providerName: string | null;
  providerKind: ProviderKind | null;
  availableModels: iProviderModelOption[];
  detectedModel: string | null;
  detectedContextSize: number | null;
  modelContextSizes: Record<string, number>;
  modelCapabilities: Record<string, iModelCapabilities>;
  modelProviders: iModelProviderOption[];
  policyCatalog: iProviderPolicyCatalog | null;
}

const MODEL_CAPABILITY_LABELS = MODEL_CAPABILITY_ENUM.derive<string>()(
  [MODEL_CAPABILITIES.STRUCTURED_OUTPUT, 'Structured responses'],
  [MODEL_CAPABILITIES.TOOL_CALLING, 'Tool calling'],
);

const DISPLAYED_MODEL_CAPABILITIES = [MODEL_CAPABILITIES.STRUCTURED_OUTPUT] as const;

const MODEL_COMPATIBILITY_TITLES = MODEL_COMPATIBILITY_STATUS_ENUM.derive<string>()(
  [MODEL_COMPATIBILITY_STATUSES.COMPATIBLE, 'Model meets project requirements'],
  [MODEL_COMPATIBILITY_STATUSES.INCOMPATIBLE, 'Model is missing required capabilities'],
  [MODEL_COMPATIBILITY_STATUSES.UNKNOWN, 'Model capabilities could not be verified'],
);

function getCapabilityIcon(isSupported: boolean | undefined) {
  if (isSupported === true) {
    return LuCircleCheck;
  }

  if (isSupported === false) {
    return LuCircleX;
  }

  return LuCircleHelp;
}

function getCapabilitySupportLabel(isSupported: boolean | undefined) {
  if (isSupported === undefined) {
    return 'Unknown';
  }

  return isSupported ? 'Yes' : 'No';
}

const outputFormatOptions: iOptionType[] = [
  {
    label: 'XML wrapper',
    value: OUTPUT_FORMATS.XML,
    description: 'Most reliable for smaller models and partial continue parsing.',
  },
  {
    label: 'JSON wrapper',
    value: OUTPUT_FORMATS.JSON,
    description: 'Useful when the provider follows JSON instructions consistently.',
  },
  {
    label: 'Raw text',
    value: OUTPUT_FORMATS.NONE,
    description: 'Fastest, but the least structured when models drift.',
  },
];

const providerOptions: iOptionType[] = [
  {
    label: 'KoboldCpp',
    value: GENERATION_PROVIDERS.KOBOLDCPP,
    description: 'Connect to a local KoboldCpp OpenAI-compatible endpoint.',
  },
  {
    label: 'OpenRouter',
    value: GENERATION_PROVIDERS.OPENROUTER,
    description: 'Use an OpenRouter API key and model ID through TanStack AI.',
  },
];

const agentGenerationBudgetOptions: iOptionType[] = AGENT_GENERATION_BUDGET_ENUM.values.map((value) => ({
  label: AGENT_GENERATION_BUDGET_LABELS.get(value),
  value,
}));

const fieldWritingStrategyOptions: iOptionType[] = FIELD_WRITING_STRATEGY_ENUM.values.map((value) => ({
  label: FIELD_WRITING_STRATEGY_LABELS.get(value),
  value,
}));

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
  const isUsingProxy = generationSettings.requestMode === REQUEST_MODES.PROXY;
  const isUsingOpenRouter = generationSettings.provider === GENERATION_PROVIDERS.OPENROUTER;
  const selectedModel = generationSettings.model.trim() || connectionHealth.detectedModel;
  const selectedProvider = connectionHealth.modelProviders.find(
    (provider) => provider.slug === generationSettings.openRouterProvider,
  );
  const hasCapabilitiesForSelectedModel = selectedModel === connectionHealth.detectedModel;
  let selectedModelCapabilities =
    selectedModel && hasCapabilitiesForSelectedModel
      ? (connectionHealth.modelCapabilities[selectedModel] ?? null)
      : null;
  if (generationSettings.openRouterProvider) {
    selectedModelCapabilities = selectedProvider?.capabilities ?? null;
  }
  const compatibilityStatus = getModelCompatibilityStatus(selectedModelCapabilities);
  const policyModel = connectionHealth.policyCatalog?.models.find((model) => model.modelId === selectedModel);
  const requiredCapabilities = getRequiredModelCapabilities();
  const policyEndpoints =
    policyModel?.endpoints.filter(
      (endpoint) =>
        (!generationSettings.openRouterProvider || endpoint.providerSlug === generationSettings.openRouterProvider) &&
        endpoint.isZeroDataRetention &&
        !endpoint.doesCollectData &&
        endpoint.isAvailable &&
        requiredCapabilities.every((capability) => endpoint.supportedCapabilities.includes(capability)),
    ) ?? [];
  const isCurrentProfileEligible = isUsingOpenRouter
    ? Boolean(policyModel && !policyModel.isModerated && policyEndpoints.length > 0)
    : compatibilityStatus === MODEL_COMPATIBILITY_STATUSES.COMPATIBLE;

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
              if (GENERATION_PROVIDER_ENUM.is(value)) {
                const provider = value;
                onSettingsChange({ provider, ...GENERATION_PROVIDER_DEFAULTS.get(provider) });
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

        <div className="flex items-end">
          <Button
            aria-label="Run endpoint health check"
            className="w-full"
            disabled={connectionHealth.isChecking}
            type="button"
            variant={BUTTON_VARIANTS.OUTLINE}
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
              if (OUTPUT_FORMAT_ENUM.is(value)) {
                onSettingsChange({ outputFormat: value });
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-generation-budget">Generation budget</Label>
          <SingleSelect
            inputId="agent-generation-budget"
            options={agentGenerationBudgetOptions}
            value={generationSettings.agentGenerationBudget}
            onValueChange={(value) => {
              if (AGENT_GENERATION_BUDGET_ENUM.is(value)) {
                onSettingsChange({
                  agentGenerationBudget: value,
                });
              }
            }}
          />
          <p className="text-sm text-muted-foreground">
            Controls bounded drafting resources. You decide whether the result is good enough before applying it.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-writing-strategy">Field writing</Label>
          <SingleSelect
            inputId="field-writing-strategy"
            options={fieldWritingStrategyOptions}
            value={generationSettings.fieldWritingStrategy}
            onValueChange={(value) => {
              if (FIELD_WRITING_STRATEGY_ENUM.is(value)) {
                onSettingsChange({
                  fieldWritingStrategy: value,
                });
              }
            }}
          />
          <p className="text-sm text-muted-foreground">
            Separate calls give each field full attention. A combined call uses fewer tokens and requests.
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
              onSettingsChange({ requestMode: checked ? REQUEST_MODES.PROXY : REQUEST_MODES.BROWSER })
            }
            aria-label="Use server proxy"
          />
        </div>
      </div>

      {connectionHealth.errorMessage ? (
        <Alert variant={ALERT_VARIANTS.DESTRUCTIVE}>
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
                  connectionHealth.providerKind === PROVIDER_KINDS.KOBOLDCPP ? 'text-foreground' : undefined,
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

      {connectionHealth.hasCompletedCheck ? (
        <Alert
          variant={
            compatibilityStatus === MODEL_COMPATIBILITY_STATUSES.INCOMPATIBLE
              ? ALERT_VARIANTS.DESTRUCTIVE
              : ALERT_VARIANTS.DEFAULT
          }
        >
          <AlertTitle>{MODEL_COMPATIBILITY_TITLES.get(compatibilityStatus)}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="break-all">{selectedModel ?? 'No model selected'}</p>
            {generationSettings.openRouterProvider ? (
              <p>Routing provider: {selectedProvider?.name ?? generationSettings.openRouterProvider}</p>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {DISPLAYED_MODEL_CAPABILITIES.map((capability) => {
                const isSupported = selectedModelCapabilities
                  ? hasModelCapability(selectedModelCapabilities, capability)
                  : undefined;
                const Icon = getCapabilityIcon(isSupported);

                return (
                  <span className="inline-flex items-center gap-1.5" key={capability}>
                    <Icon
                      className={cn(
                        'size-4',
                        isSupported === true && 'text-emerald-600 dark:text-emerald-400',
                        isSupported === undefined && 'text-muted-foreground',
                      )}
                    />
                    {MODEL_CAPABILITY_LABELS.get(capability)}: {getCapabilitySupportLabel(isSupported)}
                  </span>
                );
              })}
            </div>
            {compatibilityStatus === MODEL_COMPATIBILITY_STATUSES.UNKNOWN ? (
              <p>The provider did not publish capability metadata for this model.</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {connectionHealth.hasCompletedCheck ? (
        <Alert variant={isCurrentProfileEligible ? ALERT_VARIANTS.DEFAULT : ALERT_VARIANTS.DESTRUCTIVE}>
          <AlertTitle>
            {isCurrentProfileEligible
              ? 'Current assistant profile is eligible'
              : 'Current assistant profile is blocked'}
          </AlertTitle>
          <AlertDescription className="space-y-1">
            {isUsingOpenRouter ? (
              <>
                <p>Zero data retention, denied provider data collection, and unmoderated routing are mandatory.</p>
                {policyModel?.isModerated ? <p>The selected model is reported as moderated.</p> : null}
                {!connectionHealth.policyCatalog ? <p>Live ZDR policy metadata is unavailable or stale.</p> : null}
                {connectionHealth.policyCatalog && !policyModel ? (
                  <p>The selected model is absent from the policy catalog.</p>
                ) : null}
                {policyModel && !policyModel.isModerated && policyEndpoints.length === 0 ? (
                  <p>No available ZDR endpoint satisfies the selected provider and capability requirements.</p>
                ) : null}
                {policyEndpoints.length > 0 ? (
                  <p>
                    Eligible routing providers: {policyEndpoints.map((endpoint) => endpoint.providerSlug).join(', ')}.
                  </p>
                ) : null}
              </>
            ) : (
              <p>
                Local KoboldCpp does not require third-party ZDR certification. Capability requirements still apply and
                no remote privacy claim is made.
              </p>
            )}
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
