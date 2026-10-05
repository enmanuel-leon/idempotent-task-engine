import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { getSafeCommandEnvironment, SYSTEM_COMMANDS } from '../../src/config/command.js';

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TEST_DB_NAME = 'app_template_test_db';

function getTestUrls(): { adminUrl: string; testUrl: string } {
  const currentDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (currentDbUrl) {
    try {
      const parsedAdmin = new URL(currentDbUrl);
      parsedAdmin.pathname = '/postgres';
      parsedAdmin.search = '';

      const parsedTest = new URL(currentDbUrl);
      parsedTest.pathname = `/${TEST_DB_NAME}`;
      parsedTest.search = '?schema=public';

      return {
        adminUrl: parsedAdmin.toString(),
        testUrl: parsedTest.toString(),
      };
    } catch {
      // Fallback
    }
  }

  return {
    adminUrl: 'postgresql://postgres:postgres@localhost:5432/postgres',
    testUrl: `postgresql://postgres:postgres@localhost:5432/${TEST_DB_NAME}?schema=public`,
  };
}

const { adminUrl: ADMIN_CONNECTION_STRING, testUrl: TEST_CONNECTION_STRING } = getTestUrls();

async function ensureTestDatabase(): Promise<void> {
  const client = new Client({ connectionString: ADMIN_CONNECTION_STRING });
  try {
    await client.connect();
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DB_NAME,
    ]);
    if (result.rowCount === 0) {
      console.log(`Creating test database: ${TEST_DB_NAME}`);
      await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
      console.log(`Test database created: ${TEST_DB_NAME}`);
    }
  } finally {
    await client.end();
  }
}

function pushSchema(): void {
  console.log('Pushing Prisma schema to test database...');
  const result = spawnSync(
    SYSTEM_COMMANDS.PNPM,
    [
      'exec',
      'prisma',
      'db',
      'push',
      '--schema',
      'prisma/schema.prisma',
      '--url',
      TEST_CONNECTION_STRING,
      '--accept-data-loss',
    ],
    {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: API_ROOT,
      env: getSafeCommandEnvironment(),
    },
  );

  if (result.status !== 0) {
    let errorOutput = 'Unknown error while pushing schema';
    if (result.error) {
      errorOutput = result.error.message;
    } else if (result.stderr) {
      errorOutput = result.stderr;
    } else if (result.stdout) {
      errorOutput = result.stdout;
    }
    throw new Error(`Failed to push Prisma schema: ${errorOutput}`);
  }
  console.log('Test database schema pushed successfully.');
}

export async function setup(): Promise<void> {
  console.log('Setting up integration test environment...');
  await ensureTestDatabase();
  pushSchema();
}

export async function teardown(): Promise<void> {
  console.log('Tearing down integration test environment...');
}
