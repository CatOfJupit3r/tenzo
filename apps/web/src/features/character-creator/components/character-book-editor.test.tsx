import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CharacterBook } from '../lib/card-schema';
import { CharacterBookEditor } from './character-book-editor';

vi.mock('./editor/markdown-field-editor', () => ({
  MarkdownFieldEditor: ({
    value,
    ariaLabelledBy,
    onValueChange,
  }: {
    value: string;
    ariaLabelledBy: string;
    onValueChange: (value: string) => unknown;
  }) => (
    <textarea aria-labelledby={ariaLabelledBy} value={value} onChange={(event) => onValueChange(event.target.value)} />
  ),
}));

const characterBook = {
  name: 'Moon archive',
  description: 'Records from the lunar court.',
  extensions: { retained_book_data: true },
  entries: [
    {
      keys: ['moon'],
      content: 'The moon governs the archive.',
      extensions: { retained_entry_data: true },
      enabled: true,
      insertion_order: 3,
    },
    {
      keys: ['court'],
      content: 'The court meets at dusk.',
      extensions: {},
      enabled: false,
      insertion_order: 7,
    },
  ],
} satisfies CharacterBook;

describe('CharacterBookEditor', () => {
  it('exposes book and entry edits through accessible controls', async () => {
    const user = userEvent.setup();
    const onBookChange = vi.fn();
    const onEntryChange = vi.fn();
    render(
      <CharacterBookEditor
        characterBook={characterBook}
        onBookChange={onBookChange}
        onAddEntry={vi.fn()}
        onEntryChange={onEntryChange}
        onRemoveEntry={vi.fn()}
        onMoveEntry={vi.fn()}
      />,
    );

    const firstEntry = screen.getByRole('region', { name: 'Entry 1' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Book name' }), { target: { value: 'Court archive' } });
    fireEvent.change(within(firstEntry).getByRole('textbox', { name: 'Keys' }), {
      target: { value: 'lunar, records' },
    });
    fireEvent.change(within(firstEntry).getByRole('textbox', { name: 'Content' }), {
      target: { value: 'Updated lore' },
    });
    await user.click(within(firstEntry).getByRole('checkbox', { name: 'Enabled' }));

    expect(onBookChange).toHaveBeenLastCalledWith({ name: 'Court archive' });
    expect(onEntryChange).toHaveBeenCalledWith(0, { keys: ['lunar', 'records'] });
    expect(onEntryChange).toHaveBeenCalledWith(0, { content: 'Updated lore' });
    expect(onEntryChange).toHaveBeenCalledWith(0, { enabled: false });
  });

  it('provides add, reorder, and remove entry actions', async () => {
    const user = userEvent.setup();
    const onAddEntry = vi.fn();
    const onMoveEntry = vi.fn();
    const onRemoveEntry = vi.fn();
    render(
      <CharacterBookEditor
        characterBook={characterBook}
        onBookChange={vi.fn()}
        onAddEntry={onAddEntry}
        onEntryChange={vi.fn()}
        onRemoveEntry={onRemoveEntry}
        onMoveEntry={onMoveEntry}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Move entry down' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove entry' })[1]);

    expect(onAddEntry).toHaveBeenCalledOnce();
    expect(onMoveEntry).toHaveBeenCalledWith(0, 1);
    expect(onRemoveEntry).toHaveBeenCalledWith(1);
  });
});
