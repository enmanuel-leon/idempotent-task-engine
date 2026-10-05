import { z } from 'zod';
import { NODE_ENVIRONMENTS } from '../constants/system.constants.js';

function loadEnvFileWithoutOverridingProcessEnv(): void {
  const processEnv = Object.fromEntries(Object.entries(process.env));

  try {
    process.loadEnvFile('.env');
  } catch {
    try {
      process.loadEnvFile('apps/api/.env');
    } catch {
      // Ignored when no environment file exists
    }
  }

  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFileWithoutOverridingProcessEnv();

const envSchema = z.object({
  NODE_ENV: z
    .enum([NODE_ENVIRONMENTS.DEVELOPMENT, NODE_ENVIRONMENTS.PRODUCTION, NODE_ENVIRONMENTS.TEST])
    .default(NODE_ENVIRONMENTS.DEVELOPMENT),
  PORT: z.coerce.number().default(3100),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5180,http://127.0.0.1:5180')
    .transform((val) => val.split(',').map((origin) => origin.trim())),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://192.168.1.136:6379'),
});

export const env = envSchema.parse(process.env);
