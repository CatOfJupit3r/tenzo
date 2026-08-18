import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChatInputEditor } from './chat-input-editor';

describe('ChatInputEditor', () => {
  it('synchronizes parent replacements and clears without emitting update loops', async () => {
    const onValueChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <ChatInputEditor
        value="Initial draft"
        templates={[]}
        ariaLabel="Assistant message"
        onValueChange={onValueChange}
        onSubmit={onSubmit}
      />,
    );
    const textbox = await screen.findByRole('textbox', { name: 'Assistant message' });

    expect(textbox.textContent).toContain('Initial draft');

    rerender(
      <ChatInputEditor
        value="Replacement draft"
        templates={[]}
        ariaLabel="Assistant message"
        onValueChange={onValueChange}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => expect(textbox.textContent).toContain('Replacement draft'));
    expect(onValueChange).not.toHaveBeenCalled();

    rerender(
      <ChatInputEditor
        value=""
        templates={[]}
        ariaLabel="Assistant message"
        onValueChange={onValueChange}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => expect(textbox.textContent).toBe(''));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('submits when Enter is pressed without Shift', async () => {
    const onSubmit = vi.fn();
    render(
      <ChatInputEditor
        value=""
        templates={[]}
        ariaLabel="Assistant message"
        onValueChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const textbox = await screen.findByRole('textbox', { name: 'Assistant message' });
    textbox.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
