import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreBinaries: ['scripts/kill-ports.sh', 'gitleaks'],
  workspaces: {
    'apps/api': {
      entry: ['src/worker.ts', 'src/constants/**/*.ts', 'benchmarks/*.ts'],
      project: ['src/**/*.ts', 'prisma/**/*.ts', 'benchmarks/**/*.ts', 'tests/**/*.ts'],
      ignoreDependencies: ['pino-pretty', '@fastify/rate-limit'],
    },
    'apps/web': {
      project: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    },
  },
};

export default config;
