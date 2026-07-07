import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';

import {
  FREQUENCY_PENALTY_RANGE,
  MIN_P_RANGE,
  PRESENCE_PENALTY_RANGE,
  TEMPERATURE_RANGE,
  TOP_K_RANGE,
  TOP_P_RANGE,
} from '../lib/generation-config';
import type { iCharacterGenerationSettings } from '../lib/generation-config';
import type { iGenerationSettingsPatchHandler } from './generation-settings-contracts';

export interface iSamplingSettingsProps {
  generationSettings: iCharacterGenerationSettings;
  onSettingsChange: iGenerationSettingsPatchHandler;
}

export function SamplingSettings({ generationSettings, onSettingsChange }: iSamplingSettingsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
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
    </div>
  );
}
