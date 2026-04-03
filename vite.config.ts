import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'examples',
  resolve: {
    alias: {
      'fngr/tap': resolve(__dirname, 'src/recognizers/tap/index.ts'),
      'fngr/doubletap': resolve(__dirname, 'src/recognizers/doubletap/index.ts'),
      'fngr/longpress': resolve(__dirname, 'src/recognizers/longpress/index.ts'),
      'fngr/swipe': resolve(__dirname, 'src/recognizers/swipe/index.ts'),
      'fngr/pan': resolve(__dirname, 'src/recognizers/pan/index.ts'),
      'fngr/pinch': resolve(__dirname, 'src/recognizers/pinch/index.ts'),
      'fngr/rotate': resolve(__dirname, 'src/recognizers/rotate/index.ts'),
      'fngr/base': resolve(__dirname, 'src/core/base-recognizer'),
      'fngr': resolve(__dirname, 'src'),
    },
  },
});
