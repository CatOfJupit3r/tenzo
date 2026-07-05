import sortImports from '@trivago/prettier-plugin-sort-imports';
/**
 * Shared Prettier Configuration for startername Monorepo
 * 
 * This is the base Prettier configuration used across all workspaces.
 * Individual workspaces can extend this configuration by importing it.
 */

/**
 * Helper function to create import order pattern for workspace packages
 * Matches both:
 * - Direct imports: `import { x } from 'workspace-name'`
 * - Scoped imports: `import { x } from '@workspace-name'`
 * - Path imports: `import { x } from 'workspace-name/subpath'`
 * 
 * @param {string} workspaceName - The name of the workspace package
 * @returns {string} Regex pattern for the workspace
 */
const createWorkspacePattern = (workspaceName) => {
  // Escape special regex characters in workspace name
  const escaped = workspaceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match: workspace-name OR @workspace-name (with optional subpaths)
  return `^@?${escaped}(/.*)?$`;
};

/** @type {import("prettier").Config} */
const config = {
  trailingComma: 'all',
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  printWidth: 120,
  plugins: [sortImports],
  endOfLine: 'lf',
  importOrderParserPlugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy'],
  importOrderSeparation: true,
  importOrder: [
    '<THIRD_PARTY_MODULES>',
    // Workspace library imports
    createWorkspacePattern('startername'),
    // Project-specific path aliases
    '^@~/(.*)$',
    // Relative imports
    '^[./]',
  ],
};

export default config;
