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

  it('emits one value change for one typed character', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <ChatInputEditor
        value=""
        templates={[]}
        ariaLabel="Assistant message"
        onValueChange={onValueChange}
        onSubmit={onSubmit}
      />,
    );
    const textbox = await screen.findByRole('textbox', { name: 'Assistant message' });
    const elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    const rangeClientRectsDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
    const rangeBoundingRectDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => textbox,
    });
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [] as unknown as DOMRectList,
    });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    });

    try {
      await user.type(textbox, 'x');
      await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith('x', [], expect.any(Object)));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    } finally {
      if (elementFromPointDescriptor) {
        Object.defineProperty(document, 'elementFromPoint', elementFromPointDescriptor);
      } else {
        Reflect.deleteProperty(document, 'elementFromPoint');
      }
      if (rangeClientRectsDescriptor) {
        Object.defineProperty(Range.prototype, 'getClientRects', rangeClientRectsDescriptor);
      } else {
        Reflect.deleteProperty(Range.prototype, 'getClientRects');
      }
      if (rangeBoundingRectDescriptor) {
        Object.defineProperty(Range.prototype, 'getBoundingClientRect', rangeBoundingRectDescriptor);
      } else {
        Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
      }
    }
  });

  it('hydrates a persisted Tiptap document with template mentions', async () => {
    const onValueChange = vi.fn();
    render(
      <ChatInputEditor
        value="Use /voice-template"
        content={{
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Use ' },
                { type: 'mention', attrs: { id: 'voice-template', label: 'voice-template' } },
              ],
            },
          ],
        }}
        templates={[]}
        ariaLabel="Assistant message"
        onValueChange={onValueChange}
        onSubmit={vi.fn()}
      />,
    );

    const textbox = await screen.findByRole('textbox', { name: 'Assistant message' });
    expect(textbox.querySelector('[data-type="mention"]')).not.toBeNull();
    await waitFor(() =>
      expect(onValueChange).toHaveBeenLastCalledWith('Use /voice-template', ['voice-template'], expect.any(Object)),
    );
  });
});
