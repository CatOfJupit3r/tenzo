import { useRef, useState } from 'react';
import { LuImage, LuLoaderCircle, LuRefreshCw, LuTriangleAlert } from 'react-icons/lu';

import { Button } from '@~/components/ui/button';

import type { iCharacterImageAnalysis } from '../../lib/character-vision-contracts';

interface iGuidedImageStepProps {
  analysis: iCharacterImageAnalysis | null;
  errorMessage: string | null;
  isAnalyzing: boolean;
  onAnalyze: (file: File, hint?: string) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
}

export function GuidedImageStep({ analysis, errorMessage, isAnalyzing, onAnalyze, onRemove }: iGuidedImageStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState('');

  const handleAnalyze = async () => {
    if (file) {
      await onAnalyze(file, hint);
    }
  };

  return (
    <section className="grid gap-3 rounded-xl border p-4" aria-label="Appearance image reference">
      <div className="flex items-center gap-2">
        <LuImage className="size-4 text-primary" />
        <p className="text-sm font-medium">Reference image</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={isAnalyzing}>
        {file ? file.name : 'Choose an image'}
      </Button>
      <input
        className="h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={hint}
        disabled={isAnalyzing}
        placeholder="Optional hint, such as 'focus on clothing'"
        onChange={(event) => setHint(event.target.value)}
      />
      <Button
        type="button"
        onClick={() => {
          handleAnalyze().catch(() => undefined);
        }}
        disabled={!file || isAnalyzing}
      >
        {isAnalyzing ? <LuLoaderCircle className="size-4 animate-spin" /> : <LuRefreshCw className="size-4" />}
        {isAnalyzing ? 'Analyzing image...' : 'Analyze image'}
      </Button>
      {errorMessage ? (
        <div
          role="alert"
          className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      {analysis ? (
        <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm">
          <p className="font-medium">{analysis.subject}</p>
          <p>
            <span className="font-medium">Attire:</span> {analysis.attire || 'Not visible'}
          </p>
          <p>
            <span className="font-medium">Mood and pose:</span> {analysis.moodAndPose || 'Not clear'}
          </p>
          <p className="text-xs text-muted-foreground">Confidence: {Math.round(analysis.confidence * 100)}%</p>
          {analysis.warnings.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">{analysis.warnings.join(' ')}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setFile(null);
              onRemove().catch(() => undefined);
            }}
          >
            Remove analysis
          </Button>
        </div>
      ) : null}
    </section>
  );
}
