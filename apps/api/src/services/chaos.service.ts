import { randomInt } from 'node:crypto';

class ChaosService {
  private flakyGateway = false;
  private dbLatency = false;

  public isFlakyGatewayEnabled(): boolean {
    return this.flakyGateway;
  }

  public setFlakyGateway(enabled: boolean): void {
    this.flakyGateway = enabled;
  }

  public isDbLatencySpikeEnabled(): boolean {
    return this.dbLatency;
  }

  public setDbLatencySpike(enabled: boolean): void {
    this.dbLatency = enabled;
  }

  public getChaosStatus(): { flakyGateway: boolean; dbLatency: boolean } {
    return {
      flakyGateway: this.flakyGateway,
      dbLatency: this.dbLatency,
    };
  }

  public shouldInjectGatewayFailure(): boolean {
    if (!this.flakyGateway) {
      return false;
    }
    return randomInt(0, 100) < 25;
  }

  public async injectDbLatencyIfEnabled(): Promise<void> {
    if (!this.dbLatency) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

export const chaosService = new ChaosService();
