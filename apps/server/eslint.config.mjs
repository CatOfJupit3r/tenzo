import { createBackendConfig } from '@startername/eslint-config';

export default createBackendConfig({
  rootDir: import.meta.url,
  additionalIgnores: ['vitest.config.ts'],
});
