import { existsSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SYSTEM_PATH_DIRECTORIES = [
  '/usr/local/sbin',
  '/usr/local/bin',
  '/usr/sbin',
  '/usr/bin',
  '/sbin',
  '/bin',
];

const existingPathDirs: string[] = [];
if (process.env.PATH) {
  existingPathDirs.push(...process.env.PATH.split(':'));
}

const SAFE_LINUX_PATH = Array.from(
  new Set([...SYSTEM_PATH_DIRECTORIES, dirname(process.execPath), ...existingPathDirs]),
).join(':');

function resolveCandidatePath(candidate: string): string | null {
  if (existsSync(candidate)) {
    try {
      return realpathSync(candidate);
    } catch {
      return candidate;
    }
  }
  return null;
}

function findBinaryInPath(binaryName: string): string | null {
  const pathDirs = (process.env.PATH || '').split(':');
  for (const dir of pathDirs) {
    if (dir) {
      const fullPath = join(dir, binaryName);
      const resolved = resolveCandidatePath(fullPath);
      if (resolved) {
        return resolved;
      }
    }
  }
  return null;
}

function resolvePnpmPath(): string {
  if (process.env.PNPM_PATH) {
    const custom = resolveCandidatePath(process.env.PNPM_PATH);
    if (custom) {
      return custom;
    }
  }

  const nodeSibling = join(dirname(process.execPath), 'pnpm');
  const siblingResolved = resolveCandidatePath(nodeSibling);
  if (siblingResolved) {
    return siblingResolved;
  }

  const pathResolved = findBinaryInPath('pnpm');
  if (pathResolved) {
    return pathResolved;
  }

  const commonLocations = ['/usr/local/bin/pnpm', '/usr/bin/pnpm', '/bin/pnpm'];

  if (process.env.HOME) {
    commonLocations.push(
      join(process.env.HOME, '.local/share/pnpm/bin/pnpm'),
      join(process.env.HOME, 'setup-pnpm/node_modules/.bin/pnpm'),
    );
  }

  for (const loc of commonLocations) {
    const locResolved = resolveCandidatePath(loc);
    if (locResolved) {
      return locResolved;
    }
  }

  return 'pnpm';
}

const resolvedPnpm = resolvePnpmPath();

export const SYSTEM_COMMANDS = {
  NODE: process.execPath,
  PNPM: resolvedPnpm,
  PNPM_SCRIPT: resolvedPnpm,
  DOCKER: '/usr/bin/docker',
} as const;

export function getSafeCommandEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...overrides,
    PATH: SAFE_LINUX_PATH,
  };
}
