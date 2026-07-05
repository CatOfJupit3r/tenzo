import { createBackendConfig } from '@startername/eslint-config';

export default createBackendConfig({
  rootDir: import.meta.url,
  additionalIgnores: ['tsdown.config.ts'],
});
