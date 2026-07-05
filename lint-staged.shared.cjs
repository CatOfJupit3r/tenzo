/**
 * Shared lint-staged configuration for monorepo
 *
 * This configuration runs linting and formatting on staged files before commit.
 * It's optimized for a monorepo structure with TypeScript/JavaScript files.
 */
module.exports = (workspace) => ({
  '*.{ts,tsx}': [
    // Run via the workspace package so ESLint's flat config resolves relative to apps/${workspace}
    `pnpm --filter=${workspace} exec eslint --fix --no-warn-ignored`,
    'prettier --write',
    // Type check via pnpm for the specific workspace
    () => `pnpm --filter=${workspace} run check-types`,
  ],

  '*.{js,jsx}': [`pnpm --filter=${workspace} exec eslint --fix --no-warn-ignored`, 'prettier --write'],

  '*.{json,yaml,yml,md}': ['prettier --write'],
});
