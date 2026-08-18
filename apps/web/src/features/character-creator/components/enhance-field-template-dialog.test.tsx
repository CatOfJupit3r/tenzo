import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { iStoredExampleCharacter } from '../lib/cards/example-characters';
import { TEMPLATE_MODES } from '../lib/cards/field-templates';
import type { iFieldTemplateViewModel } from '../lib/cards/field-templates';
import { EnhanceFieldTemplateDialog } from './enhance-field-template-dialog';

function createTemplate(): iFieldTemplateViewModel {
  return {
    id: 'target-template',
    name: 'Description template',
    description: '',
    mode: TEMPLATE_MODES.prompt,
    fieldKeys: ['description'],
    content: 'Original template content',
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    isBuiltIn: false,
  };
}

function createExampleCharacter(): iStoredExampleCharacter {
  return {
    id: 'example-character',
    fileName: 'reference.json',
    sourceKind: 'json',
    includedFieldKeys: ['name', 'description', 'personality'],
    card: {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: 'Reference Name',
        description: 'Reference description',
        personality: 'Reference personality',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        tags: [],
        creator: '',
        character_version: '',
        extensions: { custom_fields: [] },
      },
    },
  };
}

describe('EnhanceFieldTemplateDialog', () => {
  it('keeps the original unchanged until the generated AI draft is applied', async () => {
    const user = userEvent.setup();
    const onEnhance = vi
      .fn()
      .mockResolvedValueOnce('Generated template content')
      .mockResolvedValueOnce('Regenerated template content');
    const onApply = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <EnhanceFieldTemplateDialog
        isOpen
        isEnhancing={false}
        targetTemplate={createTemplate()}
        fieldTemplates={[createTemplate()]}
        exampleCharacters={[]}
        onOpenChange={onOpenChange}
        onCancel={vi.fn()}
        onEnhance={onEnhance}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Generate draft' }));

    const currentTemplate = await screen.findByRole('textbox', { name: 'Current template' });
    const aiDraft = screen.getByRole('textbox', { name: 'AI draft' });
    expect(currentTemplate.textContent).toContain('Original template content');
    expect(aiDraft.textContent).toContain('Generated template content');
    expect(onApply).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Regenerate' }));
    const regeneratedDraft = await screen.findByRole('textbox', { name: 'AI draft' });
    expect(regeneratedDraft.textContent).toContain('Regenerated template content');
    expect(onEnhance).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetTemplate: expect.objectContaining({ content: 'Generated template content' }),
      }),
    );
    expect(onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Apply changes' }));

    expect(onApply).toHaveBeenCalledWith('Regenerated template content');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('sends only selected parts of a reference character', async () => {
    const user = userEvent.setup();
    const onEnhance = vi.fn().mockResolvedValue('Generated template content');

    render(
      <EnhanceFieldTemplateDialog
        isOpen
        isEnhancing={false}
        targetTemplate={createTemplate()}
        fieldTemplates={[createTemplate()]}
        exampleCharacters={[createExampleCharacter()]}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onEnhance={onEnhance}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Description' }));
    await user.click(screen.getByRole('button', { name: 'Generate draft' }));

    expect(onEnhance).toHaveBeenCalledWith(
      expect.objectContaining({
        exampleCharacters: [
          expect.objectContaining({
            name: undefined,
            description: 'Reference description',
            personality: undefined,
          }),
        ],
      }),
    );
  });

  it('can omit the current template content and shows the reference filename', async () => {
    const user = userEvent.setup();
    const onEnhance = vi.fn().mockResolvedValue('Generated template content');

    render(
      <EnhanceFieldTemplateDialog
        isOpen
        isEnhancing={false}
        targetTemplate={createTemplate()}
        fieldTemplates={[createTemplate()]}
        exampleCharacters={[createExampleCharacter()]}
        onOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onEnhance={onEnhance}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: 'Include current template content' }));
    await user.click(screen.getByRole('button', { name: 'Generate draft' }));

    expect(onEnhance).toHaveBeenCalledWith(expect.objectContaining({ shouldIncludeCurrentTemplate: false }));
  });

  it('discards the AI draft without applying it', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <EnhanceFieldTemplateDialog
        isOpen
        isEnhancing={false}
        targetTemplate={createTemplate()}
        fieldTemplates={[createTemplate()]}
        exampleCharacters={[]}
        onOpenChange={onOpenChange}
        onCancel={vi.fn()}
        onEnhance={vi.fn().mockResolvedValue('Generated template content')}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Generate draft' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
