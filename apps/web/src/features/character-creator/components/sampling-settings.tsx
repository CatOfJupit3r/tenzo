import { useState } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';
import { z } from 'zod';

import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@~/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@~/components/ui/tooltip';

import {
  FREQUENCY_PENALTY_RANGE,
  MIN_P_RANGE,
  PRESENCE_PENALTY_RANGE,
  RECOMMENDED_MINIMUM_CONTEXT_SIZE,
  RECOMMENDED_MINIMUM_MAX_TOKENS,
  TEMPERATURE_RANGE,
  TOP_K_RANGE,
  TOP_P_RANGE,
} from '../lib/generation/generation-config';
import type { iCharacterGenerationSettings } from '../lib/generation/generation-config';
import { GenerationPresets } from './generation-presets';
import type { iGenerationSettingsPatchHandler } from './generation-settings-contracts';

const MODEL_ROLE_SCHEMA = z.enum(['text', 'vision']);
const MODEL_ROLES = MODEL_ROLE_SCHEMA.enum;
type ModelRole = z.infer<typeof MODEL_ROLE_SCHEMA>;

const MODEL_ROLE_CONFIG = [
  {
    role: MODEL_ROLES.text,
    label: 'Text',
    modelKey: 'model',
    inputId: 'api-model',
    placeholder: 'Select or enter a text model ID',
    helperText: 'Used for field generation and the character assistant.',
  },
  {
    role: MODEL_ROLES.vision,
    label: 'Vision',
    modelKey: 'visionModel',
    inputId: 'vision-model',
    placeholder: 'Select or enter a vision model ID',
    helperText: 'Optional. Leave blank to use the text model for reference-image analysis.',
  },
] satisfies Array<{
  role: ModelRole;
  label: string;
  modelKey: 'model' | 'visionModel';
  inputId: string;
  placeholder: string;
  helperText: string;
}>;

export interface iSamplingSettingsProps {
  generationSettings: iCharacterGenerationSettings;
  availableModels: string[];
  detectedContextSize: number | null;
  modelContextSizes: Record<string, number>;
  onSettingsChange: iGenerationSettingsPatchHandler;
}

function SettingWarning({ message }: { message: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button aria-label={message} className="inline-flex cursor-help" type="button">
          <LuTriangleAlert className="size-4 text-amber-500" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{message}</TooltipContent>
    </Tooltip>
  );
}

export function SamplingSettings({
  generationSettings,
  availableModels,
  detectedContextSize,
  modelContextSizes,
  onSettingsChange,
}: iSamplingSettingsProps) {
  const [activeModelRole, setActiveModelRole] = useState<ModelRole>(MODEL_ROLES.text);
  const recommendedContextSize =
    modelContextSizes[generationSettings.model] ?? detectedContextSize ?? RECOMMENDED_MINIMUM_CONTEXT_SIZE;
  const hasSmallContext = generationSettings.contextSize < recommendedContextSize;
  const hasSmallResponse = generationSettings.maxTokens < RECOMMENDED_MINIMUM_MAX_TOKENS;
  const hasDetectedContext = Boolean(modelContextSizes[generationSettings.model] ?? detectedContextSize);
  const modelListId = 'detected-generation-models';

  return (
    <div className="space-y-4">
      <GenerationPresets generationSettings={generationSettings} onSettingsChange={onSettingsChange} />

      <Tabs
        value={activeModelRole}
        onValueChange={(value) => {
          const parsedRole = MODEL_ROLE_SCHEMA.safeParse(value);
          if (parsedRole.success) setActiveModelRole(parsedRole.data);
        }}
      >
        <TabsList>
          {MODEL_ROLE_CONFIG.map((config) => (
            <TabsTrigger key={config.role} value={config.role}>
              {config.label} model
            </TabsTrigger>
          ))}
        </TabsList>
        {MODEL_ROLE_CONFIG.map((config) => (
          <TabsContent key={config.role} value={config.role} className="rounded-lg border p-3">
            <div className="space-y-1.5">
              <Label htmlFor={config.inputId}>{config.label} model</Label>
              <Input
                id={config.inputId}
                list={modelListId}
                placeholder={config.placeholder}
                value={generationSettings[config.modelKey]}
                onChange={(event) => onSettingsChange({ [config.modelKey]: event.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                {availableModels.length > 0
                  ? `${availableModels.length} model IDs detected. Type any custom model ID or choose a detected one.`
                  : `${config.helperText} Run the connection health check to load provider model IDs.`}
              </p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <datalist id={modelListId}>
        {availableModels.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </datalist>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5" htmlFor="api-max-tokens">
            Max response tokens
            {hasSmallResponse ? (
              <SettingWarning
                message={`Responses below ${RECOMMENDED_MINIMUM_MAX_TOKENS.toLocaleString()} tokens may be unusually short for character generation.`}
              />
            ) : null}
          </Label>
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
          <Label className="flex items-center gap-1.5" htmlFor="api-context-size">
            Context size
            {hasSmallContext ? (
              <SettingWarning
                message={`This is below the ${recommendedContextSize.toLocaleString()}-token ${hasDetectedContext ? 'detected' : 'recommended'} context window and limits examples and prompt history.`}
              />
            ) : null}
          </Label>
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
          <p className="text-sm text-muted-foreground">Used to budget examples and prompt history.</p>
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
          <p className="text-sm text-muted-foreground">Encourages new topics by penalizing tokens already used.</p>
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
          <p className="text-sm text-muted-foreground">KoboldCpp/llama.cpp only. 0 uses the provider default.</p>
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
          <p className="text-sm text-muted-foreground">KoboldCpp/llama.cpp only. 0 uses the provider default.</p>
        </div>
      </div>
    </div>
  );
}
