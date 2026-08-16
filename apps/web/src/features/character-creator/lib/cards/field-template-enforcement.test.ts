import { describe, expect, it } from 'vitest';

import { doesValueMatchStrictFieldTemplate } from './field-template-enforcement';

describe('doesValueMatchStrictFieldTemplate', () => {
  it('accepts values that preserve literal skeleton segments around slots', () => {
    expect(
      doesValueMatchStrictFieldTemplate(
        '<START>\n{{char}}: {{gen:opening}}\n{{user}}: {{gen:reply}}',
        '<START>\n{{char}}: Hello there.\n{{user}}: Hi!',
      ),
    ).toBe(true);
  });

  it('rejects skeleton drift in literal segments', () => {
    expect(
      doesValueMatchStrictFieldTemplate(
        '<START>\n{{char}}: {{gen:opening}}\n{{user}}: {{gen:reply}}',
        '<START>\nAssistant: Hello there.\n{{user}}: Hi!',
      ),
    ).toBe(false);
  });

  it('does not reject prompt-like values that contain no strict slots', () => {
    expect(doesValueMatchStrictFieldTemplate('A fixed note', 'A different note')).toBe(false);
    expect(doesValueMatchStrictFieldTemplate('A fixed note', 'A fixed note')).toBe(true);
  });
});
