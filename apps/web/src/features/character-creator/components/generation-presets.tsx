import { useAtom } from 'jotai';
import { useMemo, useState } from 'react';
import { LuSave, LuTrash2 } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';
import { Input } from '@~/components/ui/input';
import { Label } from '@~/components/ui/label';
import { SingleSelect } from '@~/components/ui/select';

import { generationPresetsAtom } from '../atoms/generation-presets.atom';
import type { iCharacterGenerationSettings } from '../lib/generation/generation-config';
import { createGenerationPresetSettings, sanitizeGenerationPresets } from '../lib/generation/generation-presets';
import type { iGenerationSettingsPatchHandler } from './generation-settings-contracts';

export interface iGenerationPresetsProps {
  generationSettings: iCharacterGenerationSettings;
  onSettingsChange: iGenerationSettingsPatchHandler;
}

export function GenerationPresets({ generationSettings, onSettingsChange }: iGenerationPresetsProps) {
  const [storedPresets, setStoredPresets] = useAtom(generationPresetsAtom);
  const presets = useMemo(() => sanitizeGenerationPresets(storedPresets), [storedPresets]);
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;
  const options = presets.map((preset) => ({ label: preset.name, value: preset.id }));

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      return;
    }

    const preset = {
      id: globalThis.crypto.randomUUID(),
      name,
      settings: createGenerationPresetSettings(generationSettings),
    };
    setStoredPresets((current) => [...sanitizeGenerationPresets(current), preset]);
    setSelectedPresetId(preset.id);
    setPresetName('');
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label htmlFor="generation-preset">Generation preset</Label>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <SingleSelect
          inputId="generation-preset"
          isClearable
          options={options}
          placeholder="Select a saved preset"
          value={selectedPresetId}
          onValueChange={(value) => {
            setSelectedPresetId(value);
            const preset = presets.find((candidate) => candidate.id === value);
            if (preset) {
              onSettingsChange(preset.settings);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!selectedPreset}
          tooltip="Delete selected preset"
          onClick={() => {
            if (!selectedPreset) {
              return;
            }
            setStoredPresets((current) =>
              sanitizeGenerationPresets(current).filter((preset) => preset.id !== selectedPreset.id),
            );
            setSelectedPresetId(null);
          }}
        >
          <LuTrash2 className="size-4" />
          Delete
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          aria-label="Preset name"
          placeholder="Preset name"
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              savePreset();
            }
          }}
        />
        <Button type="button" disabled={!presetName.trim()} onClick={savePreset}>
          <LuSave className="size-4" />
          Save current
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Presets include models and generation controls. Provider, endpoint, request mode, and API key stay unchanged.
      </p>
    </div>
  );
}
