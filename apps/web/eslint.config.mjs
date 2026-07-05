import { createWebConfig } from '@startername/eslint-config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);
const tailwindConfigPath = path.join(currentDirname, 'src', 'index.css');

export default createWebConfig({
  rootDir: import.meta.url,
  tailwindConfigPath,
  additionalIgnores: ['./src/routeTree.gen.ts', 'vite.config.ts', 'vitest.config.ts', '**/*.css'],
});
