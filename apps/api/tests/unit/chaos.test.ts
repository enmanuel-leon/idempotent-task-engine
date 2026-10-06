import { describe, expect, it } from 'vitest';
import { chaosService } from '../../src/services/chaos.service.js';

describe('ChaosService', () => {
  it('should toggle flaky gateway status correctly', () => {
    chaosService.setFlakyGateway(true);
    expect(chaosService.isFlakyGatewayEnabled()).toBe(true);

    chaosService.setFlakyGateway(false);
    expect(chaosService.isFlakyGatewayEnabled()).toBe(false);
  });

  it('should toggle db latency spike correctly', () => {
    chaosService.setDbLatencySpike(true);
    expect(chaosService.isDbLatencySpikeEnabled()).toBe(true);

    chaosService.setDbLatencySpike(false);
    expect(chaosService.isDbLatencySpikeEnabled()).toBe(false);
  });

  it('should return false for gateway failure when disabled', () => {
    chaosService.setFlakyGateway(false);
    for (let i = 0; i < 100; i++) {
      expect(chaosService.shouldInjectGatewayFailure()).toBe(false);
    }
  });

  it('should evaluate gateway failure when enabled', () => {
    chaosService.setFlakyGateway(true);
    const result = chaosService.shouldInjectGatewayFailure();
    expect(typeof result).toBe('boolean');
    chaosService.setFlakyGateway(false);
  });

  it('should inject db latency when enabled', async () => {
    chaosService.setDbLatencySpike(false);
    await chaosService.injectDbLatencyIfEnabled();

    chaosService.setDbLatencySpike(true);
    const start = Date.now();
    await chaosService.injectDbLatencyIfEnabled();
    expect(Date.now() - start).toBeGreaterThanOrEqual(700);
    chaosService.setDbLatencySpike(false);
  });
});
