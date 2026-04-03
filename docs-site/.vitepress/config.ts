import { defineConfig } from 'vitepress';
import { resolve } from 'path';

export default defineConfig({
  title: 'fngr',
  description: 'Modern gesture recognition for the web',
  head: [['link', { rel: 'icon', href: '/favicon.png' }]],
  vite: {
    resolve: {
      alias: {
        'fngr/tap': resolve(__dirname, '../../src/recognizers/tap/index.ts'),
        'fngr/doubletap': resolve(__dirname, '../../src/recognizers/doubletap/index.ts'),
        'fngr/longpress': resolve(__dirname, '../../src/recognizers/longpress/index.ts'),
        'fngr/swipe': resolve(__dirname, '../../src/recognizers/swipe/index.ts'),
        'fngr/base': resolve(__dirname, '../../src/core/base-recognizer'),
        'fngr': resolve(__dirname, '../../src'),
      },
    },
  },
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Guides', link: '/guides/state-machine' },
      { text: 'API', link: '/api/tap' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'State Machine', link: '/guides/state-machine' },
          { text: 'Arbitration', link: '/guides/arbitration' },
          { text: 'Custom Recognizers', link: '/guides/custom-recognizers' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'TapRecognizer', link: '/api/tap' },
          { text: 'DoubleTapRecognizer', link: '/api/doubletap' },
          { text: 'LongPressRecognizer', link: '/api/longpress' },
          { text: 'SwipeRecognizer', link: '/api/swipe' },
          { text: 'Manager', link: '/api/manager' },
          { text: 'BaseRecognizer', link: '/api/base-recognizer' },
          { text: 'Arbitrator', link: '/api/arbitrator' },
          { text: 'PointerTracker', link: '/api/pointer-tracker' },
          { text: 'Types', link: '/api/types' },
        ],
      },
      {
        text: 'Contributing',
        items: [
          { text: 'Contributing', link: '/contributing' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/akoreh/fngr' },
    ],
  },
});
