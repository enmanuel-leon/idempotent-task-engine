import autocannon from 'autocannon';
import { randomUUID } from 'node:crypto';

const TARGET_URL = process.env.BENCH_URL || 'http://localhost:3100/api/v1/webhooks/epayco';
const API_KEY = process.env.API_KEY || 'test_merchant_sec_key_12345';
const DURATION_SECONDS = 15;

console.log('==========================================================');
console.log('SUITE A: HIGH CONCURRENCY STRESS BENCHMARK');
console.log(`Target: ${TARGET_URL}`);
console.log(`Duration: ${DURATION_SECONDS}s | Concurrency: 60 connections`);
console.log('==========================================================\n');

const instance = autocannon(
  {
    url: TARGET_URL,
    connections: 60,
    duration: DURATION_SECONDS,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
    },
    setupClient: (client) => {
      client.on('body', () => {
        client.setHeaders({
          'content-type': 'application/json',
          'x-api-key': API_KEY,
          'idempotency-key': randomUUID(),
        });
        client.setBody(
          JSON.stringify({
            eventType: 'PAYMENT_SUCCEEDED',
            amountCents: 2500, // $25.00
            reference: 'stress_' + randomUUID(),
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
          amountCents: 2500,
          reference: 'stress_init',
        }),
      },
    ],
  },
  (err, result) => {
    if (err) {
      console.error('Benchmark failed:', err);
      process.exit(1);
    }

    console.log(autocannon.printResult(result));

    const totalRequests = result.requests.total;
    const errors = result.errors + result.timeouts + result.non2xx;
    let failureRate = 0;
    if (totalRequests > 0) {
      failureRate = (errors / totalRequests) * 100;
    }

    const p95Latency = result.latency.p95;
    const rpsAverage = result.requests.average;

    console.log('--- Benchmark Evaluation Criteria ---');
    console.log(`RPS Average: ${rpsAverage.toFixed(1)} req/s`);
    console.log(`Failure Rate: ${failureRate.toFixed(3)}% (Target: < 0.1%)`);
    console.log(`p95 Latency: ${p95Latency}ms (Target: < 150ms)`);

    let passed = true;
    if (failureRate > 0.1) {
      console.error('FAIL: Failure rate exceeded 0.1%');
      passed = false;
    }
    if (p95Latency > 150) {
      console.warn('WARN: p95 latency exceeded 150ms ceiling');
    }

    if (passed) {
      console.log('\n>>> [SUCCESS] HIGH CONCURRENCY BENCHMARK PASSED <<<');
    } else {
      console.error('\n>>> [FAILED] HIGH CONCURRENCY BENCHMARK FAILED <<<');
      process.exit(1);
    }
  },
);

autocannon.track(instance, { renderProgressBar: true });
