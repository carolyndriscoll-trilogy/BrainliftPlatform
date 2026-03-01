import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
    },
  },
  test: {
    include: [
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'client/src/**/*.test.ts',
    ],
    globals: false,
  },
});
