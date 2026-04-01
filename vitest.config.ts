import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/helpers/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
});
