import {
  Activity,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  DollarSign,
  Flame,
  Database,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react';
import { useDashboardPage } from './use-dashboard-page';
import { formatCentsToCurrency, cn } from '../../lib/utils';

export function DashboardPage() {
  const {
    metrics,
    isConnected,
    merchant,
    transactions,
    pagination,
    isTransactionsLoading,
    isSimulatingBurst,
    isSimulatingScenarioA,
    isResettingData,
    isReplayingDlq,
    burstConcurrency,
    setBurstConcurrency,
    handleRunScenarioA,
    handleRunBurst,
    handleResetTestData,
    handleRefreshTransactions,
    handleToggleFlaky,
    handleToggleDbLatency,
    handleReplayDlq,
    page,
    handleNextPage,
    handlePrevPage,
  } = useDashboardPage();

  let connectionBadge = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      LIVE STREAM
    </span>
  );
  if (!isConnected) {
    connectionBadge = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        CONNECTING
      </span>
    );
  }

  let flakyButtonClass = 'border-slate-800 bg-[#12141A] text-slate-400 hover:border-slate-700';
  let flakyBadgeText = 'OFF (0%)';
  if (metrics.chaosStatus.flakyGateway) {
    flakyButtonClass =
      'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-500/60';
    flakyBadgeText = 'ACTIVE (25% 500s)';
  }

  let dbLatencyButtonClass = 'border-slate-800 bg-[#12141A] text-slate-400 hover:border-slate-700';
  let dbLatencyBadgeText = 'OFF (0ms)';
  if (metrics.chaosStatus.dbLatency) {
    dbLatencyButtonClass =
      'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:border-rose-500/60';
    dbLatencyBadgeText = 'ACTIVE (+800ms)';
  }

  let balanceDisplay = '$0.00';
  if (merchant) {
    balanceDisplay = formatCentsToCurrency(merchant.balanceCents, merchant.currency);
  }

  let merchantName = 'Acme Payments';
  if (merchant && merchant.name) {
    merchantName = merchant.name;
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-[#0E1017]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">
                  Idempotent Task Engine
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Exactly-Once Distributed Ingestion Gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {connectionBadge}
            <button
              type="button"
              onClick={handleResetTestData}
              disabled={isResettingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all disabled:opacity-50"
            >
              <Trash2 className={cn('w-3.5 h-3.5', isResettingData && 'animate-spin')} />
              Reset Test Data
            </button>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/5"
            >
              <Server className="w-3.5 h-3.5" />
              Bull-Board
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Interactive Testing Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Merchant Account & Settlement Balance */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Ledger Settlement Balance
              </div>
              <div className="text-3xl font-mono font-bold tracking-tight text-emerald-400">
                {balanceDisplay}
              </div>
              <p className="text-xs text-slate-400">
                Merchant: <span className="text-slate-200 font-medium">{merchantName}</span> •{' '}
                <span className="font-mono text-[11px] opacity-75">{merchant?.apiKey}</span>
              </p>
            </div>
            <div className="pt-4 border-t border-slate-850 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>PostgreSQL Namespace</span>
              <span className="text-indigo-400 font-semibold">schema = task_engine</span>
            </div>
          </div>

          {/* Test Harness 1: Scenario A (Sequential Idempotency / Cache Hit) */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  SCENARIO A: CACHE HIT
                </span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                  Target: &lt; 5ms
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Sends Request 1 (leader queues work), awaits settlement, then immediately sends
                Request 2 with the identical key to verify instantaneous Redis response cache hit.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunScenarioA}
              disabled={isSimulatingScenarioA}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all disabled:opacity-50"
            >
              <Zap
                className={cn('w-4 h-4 fill-current', isSimulatingScenarioA && 'animate-spin')}
              />
              <span>Test Scenario A (Instant Cache Hit)</span>
            </button>
          </div>

          {/* Test Harness 2: Scenario B (Customizable Concurrent Collision Burst) */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                  <Layers className="w-3.5 h-3.5" />
                  SCENARIO B: CONCURRENCY BURST
                </span>
                <span className="text-xs font-mono text-indigo-300 font-bold">
                  {burstConcurrency}x parallel
                </span>
              </div>
              <div className="my-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Concurrency Level</span>
                  <span>{burstConcurrency} callers</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={burstConcurrency}
                  onChange={(e) => setBurstConcurrency(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>5x</span>
                  <span>20x</span>
                  <span>35x</span>
                  <span>50x</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRunBurst}
              disabled={isSimulatingBurst}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Play className={cn('w-4 h-4 fill-current', isSimulatingBurst && 'animate-spin')} />
              <span>Fire {burstConcurrency}x Concurrent Burst</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: RPS */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
              <span>Throughput</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-white tracking-tight">
                {metrics.rps}
              </span>
              <span className="text-xs font-mono text-slate-400">req / sec</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Total Ingested: <span className="text-slate-200">{metrics.totalIngested}</span>
            </div>
          </div>

          {/* Card 2: Deduplication Efficiency */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
              <span>Deduplication</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-amber-400 tracking-tight">
                {metrics.dedupEfficiency}%
              </span>
              <span className="text-xs font-mono text-slate-400">efficiency</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Duplicates Intercepted:{' '}
              <span className="text-amber-300 font-bold">{metrics.totalDuplicates}</span>
            </div>
          </div>

          {/* Card 3: Latency Percentiles */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
              <span>Latency (p95 / p99)</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-white tracking-tight">
                {metrics.latencyP95}
              </span>
              <span className="text-xs font-mono text-slate-400">ms (p95)</span>
              <span className="text-xs font-mono text-slate-400 ml-1">
                / {metrics.latencyP99} ms (p99)
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">Target: &lt; 150ms p95</div>
          </div>

          {/* Card 4: Dead Letter Queue */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
              <span>Dead Letter Queue</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-mono font-bold text-rose-400 tracking-tight">
                {metrics.activeDlqCount}
              </span>
              <button
                type="button"
                onClick={handleReplayDlq}
                disabled={isReplayingDlq || metrics.activeDlqCount === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-40 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Replay All
              </button>
            </div>
            <div className="text-xs text-slate-400 font-mono">Retries Exhausted (&gt; 5)</div>
          </div>
        </div>

        {/* Chaos Engineering Controls Banner */}
        <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200 font-mono">
                Chaos Engineering Injection Switches
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Live Resilience Verification Harness
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleToggleFlaky}
              className={cn(
                'p-4 rounded-xl border text-left transition-all flex items-start justify-between gap-3',
                flakyButtonClass,
              )}
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Downstream Bank Gateway Chaos</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40">
                    {flakyBadgeText}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Simulates 25% random HTTP 500 errors from mock banking partner. Triggers BullMQ
                  full-jitter exponential backoff.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleToggleDbLatency}
              className={cn(
                'p-4 rounded-xl border text-left transition-all flex items-start justify-between gap-3',
                dbLatencyButtonClass,
              )}
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>PostgreSQL Latency Spike Chaos</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40">
                    {dbLatencyBadgeText}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Injects artificial 800ms delays into PostgreSQL write transactions. Tests
                  concurrent Redis lock contention and timeouts.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Two Columns: Live Deduplication Stream & Ledger Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Live Deduplication Feed */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] space-y-4 flex flex-col h-[460px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-slate-200">Live Deduplication Feed</h2>
              </div>
              <span className="text-xs font-mono text-slate-400">SSE Sub-Second Stream</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {metrics.recentFeed.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Activity className="w-6 h-6 opacity-30 animate-pulse" />
                  <p>Awaiting incoming webhook requests...</p>
                </div>
              )}

              {metrics.recentFeed.map((item) => {
                let badgeClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                let label = 'LEADER (MISS)';
                if (item.cacheStatus === 'HIT') {
                  badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  label = 'CACHED (HIT)';
                }
                if (item.cacheStatus === 'HIT_CONCURRENT') {
                  badgeClass = 'bg-violet-500/10 text-violet-400 border-violet-500/20';
                  label = 'CONCURRENT HIT';
                }
                if (item.cacheStatus === 'TIMEOUT_CONCURRENT') {
                  badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                  label = 'INTERCEPTED (TIMEOUT)';
                }

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-slate-800/60 bg-[#12141A] flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 truncate">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] border font-bold',
                            badgeClass,
                          )}
                        >
                          {label}
                        </span>
                        <span className="text-slate-300 font-semibold">{item.eventType}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Key: {item.idempotencyKey}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="text-emerald-400 font-medium">
                        {formatCentsToCurrency(item.amountCents)}
                      </div>
                      <div className="text-[10px] text-slate-400">{item.durationMs}ms</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Ledger Transactions Table (Server-Side Paginated) */}
          <div className="p-5 rounded-xl border border-slate-800/80 bg-[#0E1017] space-y-4 flex flex-col h-[460px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Settled Ledger Transactions
                </h2>
              </div>
              <button
                type="button"
                onClick={handleRefreshTransactions}
                disabled={isTransactionsLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-slate-800/80 text-slate-300 hover:bg-slate-750 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3 h-3', isTransactionsLoading && 'animate-spin')} />
                Refresh
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {transactions.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-6 h-6 opacity-30" />
                  <p>No settled transactions recorded yet.</p>
                </div>
              )}

              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-lg border border-slate-800/60 bg-[#12141A] flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 truncate">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {tx.status}
                      </span>
                      <span className="text-slate-300 font-semibold">{tx.reference}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">Event: {tx.eventType}</div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-emerald-400 font-medium">
                      +{formatCentsToCurrency(tx.amountCents)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination &&
              (() => {
                let displayTotalPages = 1;
                if (pagination.totalPages > 0) {
                  displayTotalPages = pagination.totalPages;
                }
                return (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>
                      Page {page} of {displayTotalPages} ({pagination.total} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrevPage}
                        disabled={page <= 1}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-all"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={handleNextPage}
                        disabled={page >= pagination.totalPages}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0E1017]/40 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-mono gap-2">
          <span>Idempotent Task Engine</span>
          <span>Live Ingestion &amp; Resilience Telemetry</span>
        </div>
      </footer>
    </div>
  );
}
