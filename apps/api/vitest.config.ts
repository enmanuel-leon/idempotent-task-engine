import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile('.env');
} catch {
  // Ignored in environments where .env is not present (e.g. CI)
}

let testDbUrl = 'postgresql://postgres:postgres@localhost:5432/app_template_test_db?schema=public';
if (process.env.TEST_DATABASE_URL) {
  testDbUrl = process.env.TEST_DATABASE_URL;
} else if (process.env.DATABASE_URL) {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    parsed.pathname = '/app_template_test_db';
    testDbUrl = parsed.toString();
  } catch {
    // fallback
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/setup/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
      BETTER_AUTH_SECRET: 'test-super-secret-key-32-chars-min-length',
      BETTER_AUTH_URL: 'http://localhost:3000',
      EMAIL_ENABLED: 'false',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        'prisma/**',
        'src/server.ts',
        'src/constants/**',
      ],
    },
  },
});
