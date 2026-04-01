import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'core/base-recognizer': 'src/core/base-recognizer.ts',
  },
  format: ['esm'],
  dts: true,
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  splitting: true,
  treeshake: true,
});
