import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'core/base-recognizer': 'src/core/base-recognizer.ts',
    'recognizers/tap': 'src/recognizers/tap/index.ts',
    'recognizers/doubletap': 'src/recognizers/doubletap/index.ts',
    'recognizers/longpress': 'src/recognizers/longpress/index.ts',
    'recognizers/swipe': 'src/recognizers/swipe/index.ts',
    'recognizers/pan': 'src/recognizers/pan/index.ts',
    'recognizers/pinch': 'src/recognizers/pinch/index.ts',
    'recognizers/rotate': 'src/recognizers/rotate/index.ts',
  },
  format: ['esm'],
  dts: true,
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  splitting: true,
  treeshake: true,
});
