import autocannon from 'autocannon';
import { randomUUID } from 'node:crypto';

const TARGET_URL = process.env.BENCH_URL || 'http://localhost:3100/api/v1/webhooks/epayco';
const API_KEY = process.env.API_KEY || 'test_merchant_sec_key_12345';
const SPIKE_CONNECTIONS = 80;
const DURATION_SECONDS = 15;

console.log('==========================================================');
console.log('ENTERPRISE SUITE: HIGH-THROUGHPUT SPIKE TEST');
console.log(`Target: ${TARGET_URL}`);
console.log(`Connections: ${SPIKE_CONNECTIONS} | Duration: ${DURATION_SECONDS}s`);
console.log('Simulating immediate 10x traffic surge to test gateway elasticity');
console.log('==========================================================\n');

const instance = autocannon(
  {
    url: TARGET_URL,
    connections: SPIKE_CONNECTIONS,
    duration: DURATION_SECONDS,
    pipelining: 1,
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
            amountCents: 5000,
            reference: 'spk_' + idKey,
          }),
        );
      });
    },
    requests: [
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': API_KEY,
          'idempotency-key': randomUUID(),
        },
        body: JSON.stringify({
          eventType: 'PAYMENT_SUCCEEDED',
          amountCents: 5000,
          reference: 'spk_init',
        }),
      },
    ],
  },
  (err, result) => {
    if (err) {
      console.error('Spike test failed:', err);
      process.exit(1);
    }

    console.log(autocannon.printResult(result));

    const total = result.requests.total;
    const errors = result.errors + result.timeouts + result.non2xx;
    let failureRate = 0;
    if (total > 0) {
      failureRate = (errors / total) * 100;
    }

    console.log('--- Spike Test Evaluation ---');
    console.log(`Total Spike Requests: ${total}`);
    console.log(`RPS Peak / Average: ${result.requests.average.toFixed(1)} req/s`);
    console.log(`p95 Latency: ${result.latency.p95}ms`);
    console.log(`Failure Rate: ${failureRate.toFixed(3)}% (Target: < 0.1%)`);

    let passed = true;
    if (failureRate > 0.1) {
      console.error('FAIL: Error rate exceeded 0.1% threshold under spike');
      passed = false;
    }

    if (passed) {
      console.log('\n>>> [SUCCESS] GATEWAY ELASTICITY & SPIKE HANDLING VERIFIED <<<');
    } else {
      console.error('\n>>> [FAILURE] SPIKE BENCHMARK FAILED <<<');
      process.exit(1);
    }
  },
);

autocannon.track(instance, { renderProgressBar: true });
