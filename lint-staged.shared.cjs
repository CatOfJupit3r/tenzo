/**
 * Shared lint-staged configuration for startername monorepo
 *
 * This configuration runs linting and formatting on staged files before commit.
 * It's optimized for a monorepo structure with TypeScript/JavaScript files.
 *
 * @param {string} workspace - The moon workspace name (e.g., 'server', 'web', 'shared')
 */
module.exports = (workspace) => ({
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    // Type check via moon for the specific workspace
    () => `pnpm exec moon run ${workspace}:check-types`,
  ],

  '*.{js,jsx}': ['eslint --fix', 'prettier --write'],

  '*.{json,yaml,yml,md}': ['prettier --write'],
});
