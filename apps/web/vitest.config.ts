import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        '**/*.config.ts',
        'src/main.tsx',
        'src/constants/**',
        'src/**/*.tsx',
        'src/locales/**',
      ],
    },
  },
});
