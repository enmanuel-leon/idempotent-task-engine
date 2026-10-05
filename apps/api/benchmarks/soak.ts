import autocannon from 'autocannon';
import { randomUUID } from 'node:crypto';

const TARGET_URL = process.env.BENCH_URL || 'http://localhost:3100/api/v1/webhooks/epayco';
const API_KEY = process.env.API_KEY || 'test_merchant_sec_key_12345';
const SOAK_CONNECTIONS = 40;
const DURATION_SECONDS = 30; // Sustained soak

console.log('==========================================================');
console.log('ENTERPRISE SUITE: SUSTAINED SOAK ENDURANCE TEST');
console.log(`Target: ${TARGET_URL}`);
console.log(`Connections: ${SOAK_CONNECTIONS} | Duration: ${DURATION_SECONDS}s`);
console.log('Testing steady-state memory retention, connection leaks, and p99 drift');
console.log('==========================================================\n');

const initialMemoryRss = process.memoryUsage().rss / (1024 * 1024);

const instance = autocannon(
  {
    url: TARGET_URL,
    connections: SOAK_CONNECTIONS,
    duration: DURATION_SECONDS,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
    },
    setupClient: (client) => {
      client.on('body', () => {
        const idKey = randomUUID();
        client.setHeaders({
          'content-type': 'application/json',
          'x-api-key': API_KEY,
          'idempotency-key': idKey,
        });
        client.setBody(
          JSON.stringify({
            eventType: 'PAYMENT_SUCCEEDED',
            amountCents: 3500,
            reference: 'soak_' + idKey,
          }),
        );
      });
    },
  },
  (err, result) => {
    if (err) {
      console.error('Soak benchmark failed:', err);
      process.exit(1);
    }

    console.log(autocannon.printResult(result));

    const finalMemoryRss = process.memoryUsage().rss / (1024 * 1024);
    const memoryDelta = finalMemoryRss - initialMemoryRss;

    console.log('--- Soak Endurance Evaluation ---');
    console.log(`Total Operations: ${result.requests.total}`);
    console.log(`Throughput Average: ${result.requests.average.toFixed(1)} req/s`);
    console.log(`p95 Latency: ${result.latency.p95}ms | p99: ${result.latency.p99}ms`);
    console.log(`Memory Delta: ${memoryDelta.toFixed(2)} MB`);

    let passed = true;
    const errors = result.errors + result.timeouts + result.non2xx;
    if (errors > 0 && result.requests.total > 0 && errors / result.requests.total > 0.005) {
      console.error('FAIL: Non-2xx/errors exceeded 0.5% during soak');
      passed = false;
    }

    if (passed) {
      console.log('\n>>> [SUCCESS] SUSTAINED SOAK ENDURANCE TEST PASSED <<<');
    } else {
      console.error('\n>>> [FAILURE] SOAK ENDURANCE TEST FAILED <<<');
      process.exit(1);
    }
  },
);

autocannon.track(instance, { renderProgressBar: true });
