import { describe, expect, it } from 'vitest';
import { SYSTEM_COMMANDS, getSafeCommandEnvironment } from '../../src/config/command.js';

describe('System Commands Configuration', () => {
  it('has non-empty string properties for core system binaries', () => {
    expect(typeof SYSTEM_COMMANDS.NODE).toBe('string');
    expect(SYSTEM_COMMANDS.NODE.length).toBeGreaterThan(0);

    expect(typeof SYSTEM_COMMANDS.PNPM).toBe('string');
    expect(SYSTEM_COMMANDS.PNPM.length).toBeGreaterThan(0);

    expect(typeof SYSTEM_COMMANDS.PNPM_SCRIPT).toBe('string');
    expect(SYSTEM_COMMANDS.PNPM_SCRIPT.length).toBeGreaterThan(0);

    expect(typeof SYSTEM_COMMANDS.DOCKER).toBe('string');
    expect(SYSTEM_COMMANDS.DOCKER.length).toBeGreaterThan(0);
  });

  it('returns a safe command environment containing standard system paths', () => {
    const env = getSafeCommandEnvironment();
    expect(typeof env.PATH).toBe('string');
    expect(env.PATH).toContain('/usr/bin');
  });

  it('preserves custom environment variable overrides', () => {
    const env = getSafeCommandEnvironment({ TEST_VAR: 'hello' });
    expect(env.TEST_VAR).toBe('hello');
  });
});
