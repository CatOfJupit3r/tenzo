/**
 * Shared ESLint Configuration Factory for startername Monorepo
 * 
 * This module provides a factory function to create ESLint configurations
 * for different project types (backend, web) with consistent rules across
 * the monorepo.
 */
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import { configs, plugins, rules } from 'eslint-config-airbnb-extended';
import { rules as prettierConfigRules } from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import prettierPlugin from 'eslint-plugin-prettier';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Helper function to create ignore patterns for workspace packages
 * Used for import resolution rules to prevent false positives
 * 
 * @param {string} workspaceName - The name of the workspace package
 * @returns {string} Regex pattern for the workspace
 */
const createWorkspaceIgnorePattern = (workspaceName) => {
  // Escape special regex characters in workspace name
  const escaped = workspaceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match: workspace-name OR @workspace-name (with optional subpaths)
  return `^@?${escaped}(/.*)?$`;
};

/**
 * Common base configuration shared across all project types
 */
const getBaseConfig = (options) => {
  const { tsconfigRootDir, gitignorePath } = options;

  const jsConfig = [
    // ESLint Recommended Rules
    {
      name: 'js/config',
      ...js.configs.recommended,
    },
    // Stylistic Plugin
    plugins.stylistic,
    // Import X Plugin
    plugins.importX,
    // Airbnb Base Recommended Config
    ...configs.base.recommended,
    // Strict Import Config
    rules.base.importsStrict,
  ];

  const typescriptConfig = [
    // TypeScript ESLint Plugin
    plugins.typescriptEslint,
    // Airbnb Base TypeScript Config
    ...configs.base.typescript,
    // Strict TypeScript Config
    rules.typescript.typescriptEslintStrict,
  ];

  const prettierConfig = [
    // Prettier Plugin
    {
      name: 'prettier/plugin/config',
      plugins: {
        prettier: prettierPlugin,
      },
    },
    // Prettier Config
    {
      name: 'prettier/config',
      rules: {
        ...prettierConfigRules,
        'prettier/prettier': [
          'warn',
          {
            endOfLine: 'auto',
          },
        ],
      },
    },
  ];

  const modelFileOverrides = {
    files: ['**/*.model.ts'],
    rules: {
      'max-classes-per-file': 'off',
    },
  };

  const sharedRules = {
    rules: {
      // "@typescript-eslint/explicit-member-accessibility": "error",
      'import-x/prefer-default-export': 'off',
      'no-console': 'off',
      'no-continue': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-await-in-loop': 'off',
      'import-x/no-unresolved': [
        'error',
        {
          ignore: [
            '^@~/',
            // Workspace packages (prevent false positives)
            createWorkspaceIgnorePattern('startername'),
            createWorkspaceIgnorePattern('shared'),
          ],
        },
      ],
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
          optionalDependencies: false,
          peerDependencies: false,
          packageDir: ['./', '../..'],
        },
      ],
      // prettier plugin is responsible for formatting issues
      'import-x/order': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'TSVoidKeyword:not(TSInterfaceDeclaration TSVoidKeyword, TSAbstractMethodDefinition TSVoidKeyword, TSAbstractPropertyDefinition TSVoidKeyword, TSTypeAliasDeclaration TSVoidKeyword, TSDeclareFunction TSVoidKeyword, TSMethodSignature TSVoidKeyword, MethodDefinition:not([value.body]) TSVoidKeyword)',
          message:
            'Using explicit `void` or `Promise<void>` is not encouraged. Please either do not specify a return type or specify the type.',
        },
        {
          selector: 'TSEnumDeclaration',
          message: "Avoid using 'enum' as a type. Use `const SOME_ENUM = { VALUE: 'VALUE'; } as const` instead.",
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      'no-void': ['error', { allowAsStatement: true }],
      'import-x/no-named-as-default': 'off',
      'class-methods-use-this': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          prefix: ['i'],
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase', 'camelCase', 'UPPER_CASE'],
          prefix: ['is', 'should', 'has', 'can', 'did', 'will', 'have', 'might'],
        },
        {
          selector: 'variable',
          types: ['boolean'],
          modifiers: ['const'],
          format: null,
          custom: {
            regex: '^(is|should|has|can|did|will|have|might|was)[A-Z][a-zA-Z]*$|^(IS|SHOULD|HAS|CAN|DID|WILL|HAVE|MIGHT|WAS)_[A-Z_]+$',
            match: true,
          },
        },
      ],
      '@typescript-eslint/only-throw-error': 'off',
      'import-x/no-anonymous-default-export': 'off',
      '@typescript-eslint/array-type': 'off',
      'no-underscore-dangle': [
        'error',
        {
          allow: ['__dirname', '__filename', '_id', '_doc', '_meta', 'id_', '__typename'],
        },
      ],
      'prettier/prettier': 'off',
    },
  };

  return {
    baseIgnores: [
      {
        ignores: [
          'node_modules/**',
          '*.config.{js,mjs,cjs,ts}',
          '**/*.config.{js,mjs,cjs,ts}',
          'test/**',
          'tests/**',
          'dist/**',
          'build/**',
          '.lintstagedrc.{js,cjs,mjs}',
        ],
      },
      ...(gitignorePath ? [includeIgnoreFile(gitignorePath)] : []),
    ],
    jsConfig,
    typescriptConfig,
    prettierConfig,
    sharedRules,
    modelFileOverrides,
    typescriptSettings: [
      {
        name: 'typescript/parser-options',
        languageOptions: {
          parserOptions: {
            projectService: true,
            tsconfigRootDir,
          },
        },
      },
      {
        name: 'typescript/import-resolver',
        settings: {
          'import-x/resolver-next': [
            createTypeScriptImportResolver({
              alwaysTryTypes: true,
              bun: true,
            }),
          ],
        },
      },
    ],
  };
};

/**
 * Create ESLint configuration for backend/Node.js projects
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.rootDir - Root directory of the project (typically import.meta.url)
 * @param {string[]} [options.additionalIgnores] - Additional patterns to ignore
 * @returns {Array} ESLint flat config array
 */
export const createBackendConfig = (options = {}) => {
  const { rootDir, additionalIgnores = [] } = options;
  
  const currentFilename = fileURLToPath(rootDir);
  const currentDirname = path.dirname(currentFilename);
  const tsconfigRootDir = path.resolve(currentDirname);
  const gitignorePath = path.resolve(currentDirname, '.gitignore');

  const base = getBaseConfig({ tsconfigRootDir, gitignorePath });

  const nodeConfig = [
    // Node Plugin
    plugins.node,
    // Airbnb Node Recommended Config
    ...configs.node.recommended,
  ];

  const nodeSpecificRules = {
    rules: {
      'n/no-unsupported-features/node-builtins': ['error', { version: '>=24.0.0' }],
    },
  };

  return [
    ...base.baseIgnores,
    ...(additionalIgnores.length > 0 ? [{ ignores: additionalIgnores }] : []),
    ...base.jsConfig,
    ...nodeConfig,
    ...base.typescriptConfig,
    ...base.typescriptSettings,
    ...base.prettierConfig,
    base.sharedRules,
    base.modelFileOverrides,
    nodeSpecificRules,
  ];
};

const importPlugin = async (pluginName) => {
  try {
    const plugin = await import(pluginName);
    return plugin.default;
  } catch (e) {
    console.warn(`${pluginName} not installed, skipping related rules`);
    return null;
  }

};

/**
 * Create ESLint configuration for web/React projects
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.rootDir - Root directory of the project (typically import.meta.url)
 * @param {string} [options.tailwindConfigPath] - Path to Tailwind CSS config
 * @param {string[]} [options.additionalIgnores] - Additional patterns to ignore
 * @returns {Promise<Array>} ESLint flat config array
 */
export const createWebConfig = async (options = {}) => {
  const { rootDir, tailwindConfigPath, additionalIgnores = [] } = options;
  
  const currentFilename = fileURLToPath(rootDir);
  const currentDirname = path.dirname(currentFilename);
  const tsconfigRootDir = path.resolve(currentDirname);
  const gitignorePath = path.resolve(currentDirname, '.gitignore');

  const base = getBaseConfig({ tsconfigRootDir, gitignorePath });

  // Dynamic imports for web-specific plugins
  const tailwindcssPlugin = await importPlugin('eslint-plugin-better-tailwindcss');
  const pluginRouter = await importPlugin('@tanstack/eslint-plugin-router');
  const queryPlugin = await importPlugin('@tanstack/eslint-plugin-query');
  const reactRefreshPlugin = await importPlugin('eslint-plugin-react-refresh');

  const reactConfig = [
    // React Plugin
    plugins.react,
    // React Hooks Plugin
    plugins.reactHooks,
    // React JSX A11y Plugin
    plugins.reactA11y,
    // Airbnb React Recommended Config
    ...configs.react.recommended,
    // Strict React Config
    rules.react.strict,
    // Airbnb React TypeScript Config
    ...configs.react.typescript,
    {
      files: ['**/*.{jsx,tsx}'],
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      plugins: {
        ...(tailwindcssPlugin && { 'better-tailwindcss': tailwindcssPlugin }),
        ...(reactRefreshPlugin && { 'react-refresh': reactRefreshPlugin }),
      },
      rules: {
        ...(tailwindcssPlugin && {
          ...tailwindcssPlugin.configs['stylistic-error'].rules,
          ...tailwindcssPlugin.configs['correctness-error'].rules,
          'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
          'better-tailwindcss/no-unregistered-classes': 'off',
        }),
        ...(reactRefreshPlugin && {
          'react-refresh/only-export-components': 'error',
        }),
      },
    },
    ...(reactRefreshPlugin ? [
      {
        // disable for route files since they often export non-component values (like route metadata)
        files: ['src/routes/**/*.{jsx,tsx}'],
        rules: {
          'react-refresh/only-export-components': 'off',
        },
      }
    ] : []),
    ...(pluginRouter ? pluginRouter.configs['flat/recommended'] : []),
    ...(queryPlugin ? queryPlugin.configs['flat/recommended'] : []),
  ];

  const webSpecificRules = {
    rules: {
      'react/function-component-definition': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-sort-props': 'off',
      'react/jsx-fragments': 'off',
      'react/require-default-props': 'off',
      'no-param-reassign': [
        'error',
        {
          ignorePropertyModificationsFor: ['prev'],
          ignorePropertyModificationsForRegex: ['^prev', '^draft'],
        }
      ],
      'better-tailwindcss/no-unknown-classes': 'off',
      '@typescript-eslint/no-use-before-define': [
        'error',
        {
          functions: false,
        },
      ],
      'jsx-a11y/label-has-associated-control': [
        'error',
        {
          labelComponents: ['Label'],
          labelAttributes: ['htmlFor'],
          controlComponents: ['Input', 'input', 'Textarea', 'textarea'],
          assert: 'either',
          depth: 3,
        },
      ],
    },
  };

  const tailwindSettings = tailwindConfigPath
    ? [
        {
          settings: {
            'better-tailwindcss': {
              entryPoint: tailwindConfigPath,
            },
          },
        },
      ]
    : [];

  return [
    ...base.baseIgnores,
    ...(additionalIgnores.length > 0 ? [{ ignores: additionalIgnores }] : []),
    ...tailwindSettings,
    ...base.jsConfig,
    ...reactConfig,
    ...base.typescriptConfig,
    ...base.typescriptSettings,
    ...base.prettierConfig,
    base.sharedRules,
    base.modelFileOverrides,
    webSpecificRules,
  ];
};
