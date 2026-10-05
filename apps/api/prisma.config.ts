import { defineConfig } from 'prisma/config';

const processEnv = Object.fromEntries(Object.entries(process.env));

try {
  process.loadEnvFile('.env');
} catch {
  // Ignored when no environment file exists
}

for (const [key, value] of Object.entries(processEnv)) {
  if (value !== undefined) {
    process.env[key] = value;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/app_template_db',
  },
});
