import { useCallback, useRef, useState } from 'react';
import { ZodError } from 'zod';

import { loggerFactory } from '@~/lib/logging/logger';

import type { iFieldTemplateViewModel } from '../lib/cards/field-templates';
import { isGenerationAbort } from '../lib/generation/abort-safe-stream';
import { REQUEST_MODES } from '../lib/generation/generation-config';
import type { iCharacterGenerationSettings } from '../lib/generation/generation-config';
import { streamCharacterText } from '../lib/generation/tanstack-ai-text-generation';
import { buildGenerationErrorMessage, readTextResponseStream } from '../lib/generation/text-response-stream';
import type { iPromptExampleCharacter } from '../lib/prompt/generation-contracts';
import { PROVIDER_KINDS } from '../lib/provider/provider-health';
import type { ProviderKind } from '../lib/provider/provider-health';
import {
  buildTemplateEnhancementMessages,
  normalizeTemplateEnhancementResponse,
} from '../lib/templates/template-enhancement';

const TEMPLATE_ENHANCEMENT_LOGGER = loggerFactory.getLogger('character-creator.template-enhancement');

interface iUseTemplateEnhancementOptions {
  generationSettings: iCharacterGenerationSettings;
  apiKey: string;
  providerKind: ProviderKind | null;
}

export interface iEnhanceTemplateOptions {
  targetTemplate: iFieldTemplateViewModel;
  shouldIncludeCurrentTemplate: boolean;
  referenceTemplates: iFieldTemplateViewModel[];
  exampleCharacters: iPromptExampleCharacter[];
  guidance: string;
}

export function useTemplateEnhancement({ generationSettings, apiKey, providerKind }: iUseTemplateEnhancementOptions) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelEnhancement = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const enhanceTemplate = useCallback(
    async (options: iEnhanceTemplateOptions) => {
      if (!generationSettings.endpoint.trim()) {
        throw new Error('Set an API endpoint before enhancing a template.');
      }

      if (!generationSettings.model.trim()) {
        throw new Error('Set a model name before enhancing a template.');
      }

      if (!apiKey.trim()) {
        throw new Error('Set an API key before enhancing a template.');
      }

      const abortController = new AbortController();
      abortControllerRef.current?.abort();
      abortControllerRef.current = abortController;
      setIsEnhancing(true);

      const operationContext = {
        operation: 'template-enhancement',
        requestMode: generationSettings.requestMode,
        model: generationSettings.model,
        ...(providerKind ? { providerKind } : {}),
        templateMode: options.targetTemplate.mode,
        referenceTemplateCount: options.referenceTemplates.length,
        exampleCharacterCount: options.exampleCharacters.length,
      };
      TEMPLATE_ENHANCEMENT_LOGGER.debug('Template enhancement started', operationContext);

      try {
        const requestData = {
          provider: generationSettings.provider,
          endpoint: generationSettings.endpoint,
          apiKey,
          model: generationSettings.model,
          openRouterProvider: generationSettings.openRouterProvider,
          maxTokens: generationSettings.maxTokens,
          temperature: generationSettings.temperature,
          topP: generationSettings.topP,
          frequencyPenalty: generationSettings.frequencyPenalty,
          presencePenalty: generationSettings.presencePenalty,
          topK: generationSettings.topK,
          minP: generationSettings.minP,
          shouldSendDisabledSamplers: providerKind === PROVIDER_KINDS.koboldcpp,
          messages: buildTemplateEnhancementMessages(options),
        };
        let generatedContent = '';

        TEMPLATE_ENHANCEMENT_LOGGER.debug('Template enhancement branch selected', {
          ...operationContext,
          branch: generationSettings.requestMode === REQUEST_MODES.browser ? 'browser' : 'proxy',
        });

        if (generationSettings.requestMode === REQUEST_MODES.browser) {
          const result = streamCharacterText({ ...requestData, signal: abortController.signal });

          for await (const content of result.textStream) {
            generatedContent += content;
          }
        } else {
          const response = await fetch('/api/character-generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error(await buildGenerationErrorMessage(response));
          }

          generatedContent = await readTextResponseStream({
            response,
            signal: abortController.signal,
            onContent: () => undefined,
          });
        }

        const enhancedContent = normalizeTemplateEnhancementResponse(generatedContent);

        if (!enhancedContent) {
          throw new Error('The model returned an empty template.');
        }

        TEMPLATE_ENHANCEMENT_LOGGER.debug('Template enhancement completed', operationContext);

        return enhancedContent;
      } catch (error) {
        if (
          !(error instanceof ZodError) &&
          !(error instanceof SyntaxError) &&
          !isGenerationAbort(error, abortController.signal)
        ) {
          TEMPLATE_ENHANCEMENT_LOGGER.error('Template enhancement failed', error, operationContext);
        }

        throw error;
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
          setIsEnhancing(false);
        }
      }
    },
    [apiKey, generationSettings, providerKind],
  );

  return {
    isEnhancing,
    enhanceTemplate,
    cancelEnhancement,
  };
}
