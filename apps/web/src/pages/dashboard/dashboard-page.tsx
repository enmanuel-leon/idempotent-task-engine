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
  Sparkles,
  History,
  Radio,
  Gauge,
} from 'lucide-react';
import { useDashboardPage } from './use-dashboard-page';
import { formatCentsToCurrency, formatSignedCents, cn } from '../../lib/utils';
import { ConfirmModal } from '../../components/ui/confirm-modal';

export function DashboardPage() {
  const {
    metrics,
    isConnected,
    merchant,
    transactions,
    pagination,
    isTransactionsLoading,
    events,
    eventsPagination,
    isEventsLoading,
    activeTab,
    setActiveTab,
    burstConcurrency,
    setBurstConcurrency,
    realisticVolume,
    setRealisticVolume,
    realisticDupRatio,
    setRealisticDupRatio,
    lastExecutionSummary,
    isSimulatingBurst,
    isSimulatingScenarioA,
    isSimulatingRealistic,
    isResettingData,
    isReplayingDlq,
    isResetConfirmOpen,
    setIsResetConfirmOpen,
    isReplayDlqConfirmOpen,
    setIsReplayDlqConfirmOpen,
    isBurstConfirmOpen,
    setIsBurstConfirmOpen,
    handleRunScenarioA,
    handleRunBurst,
    executeBurstRequests,
    handleRunRealisticWorkload,
    handleConfirmResetData,
    handleConfirmReplayDlq,
    handleRefreshTransactions,
    handleToggleFlaky,
    handleToggleDbLatency,
    page,
    handleNextPage,
    handlePrevPage,
    eventsPage,
    handleNextEventsPage,
    handlePrevEventsPage,
  } = useDashboardPage();

  const liveFeedItems = metrics.recentFeed.slice(0, 15);

  let connectionBadge = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-green-500/10 text-green-400 border border-green-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      LIVE STREAM
    </span>
  );
  if (!isConnected) {
    connectionBadge = (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        CONNECTING
      </span>
    );
  }

  let flakyButtonClass = 'border-slate-800 bg-[#161922] text-slate-400 hover:border-slate-700';
  let flakyBadgeText = 'OFF (0%)';
  if (metrics.chaosStatus.flakyGateway) {
    flakyButtonClass =
      'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-500/60';
    flakyBadgeText = 'ACTIVE (25% 500s)';
  }

  let dbLatencyButtonClass = 'border-slate-800 bg-[#161922] text-slate-400 hover:border-slate-700';
  let dbLatencyBadgeText = 'OFF (0ms)';
  if (metrics.chaosStatus.dbLatency) {
    dbLatencyButtonClass =
      'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-500/60';
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

  const burstModalTitle = 'Dispatch High-Concurrency Burst (' + burstConcurrency + 'x)?';
  const burstModalDesc =
    'You are about to dispatch ' +
    burstConcurrency +
    ' concurrent HTTP callers with the identical idempotency key simultaneously to test high-contention locking.';

  return (
    <div className="min-h-screen bg-[#0B0D13] text-slate-100 flex flex-col font-sans selection:bg-slate-700 selection:text-white">
      {/* Modals for Destructive and High-Impact Actions */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset All Test Data?"
        description="This will purge all settled transactions, webhook event audit logs, and flush temporary Redis locks/cache strictly within the task_engine schema. Merchant balance will reset to $10,000.00."
        confirmLabel="Yes, Reset Data"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isResettingData}
        onConfirm={handleConfirmResetData}
        onClose={() => setIsResetConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isReplayDlqConfirmOpen}
        title="Replay Dead Letter Queue Jobs?"
        description="This will atomically re-queue all dead-lettered jobs from webhooks-dlq back into webhooks-incoming with reset attempt counters."
        confirmLabel="Replay All DLQ"
        cancelLabel="Cancel"
        variant="warning"
        isLoading={isReplayingDlq}
        onConfirm={handleConfirmReplayDlq}
        onClose={() => setIsReplayDlqConfirmOpen(false)}
      />

      <ConfirmModal
        isOpen={isBurstConfirmOpen}
        title={burstModalTitle}
        description={burstModalDesc}
        confirmLabel="Launch Burst"
        cancelLabel="Cancel"
        variant="primary"
        isLoading={isSimulatingBurst}
        onConfirm={executeBurstRequests}
        onClose={() => setIsBurstConfirmOpen(false)}
      />

      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-[#11141D]/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
              <ShieldCheck className="w-4 h-4 text-slate-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-sm">
                  Idempotent Task Engine
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Exactly-Once Distributed Ingestion Gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {connectionBadge}
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              disabled={isResettingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors disabled:opacity-40"
            >
              <Trash2 className={cn('w-3.5 h-3.5', isResettingData && 'animate-spin')} />
              Reset Test Data
            </button>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800"
            >
              <Server className="w-3.5 h-3.5" />
              Bull-Board
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Last Execution Summary Banner */}
        {lastExecutionSummary && (
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-slate-200 font-semibold">
                  Last Run Performance Summary • {lastExecutionSummary.scenarioName}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Logged at {lastExecutionSummary.timestamp}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-0.5">
                <div className="text-[11px] font-mono text-slate-400">
                  Peak Effective Throughput
                </div>
                <div className="text-2xl font-mono font-bold text-cyan-400 tracking-tight">
                  {lastExecutionSummary.effectiveRps}{' '}
                  <span className="text-xs font-normal text-slate-400">req/s</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[11px] font-mono text-slate-400">Total Run Execution Time</div>
                <div className="text-2xl font-mono font-bold text-white tracking-tight">
                  {lastExecutionSummary.totalDurationMs}{' '}
                  <span className="text-xs font-normal text-slate-400">ms</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[11px] font-mono text-slate-400">Interception Rate</div>
                <div className="text-2xl font-mono font-bold text-amber-400 tracking-tight">
                  {lastExecutionSummary.dedupEfficiency}%
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[11px] font-mono text-slate-400">Burst p95 / p99 Latency</div>
                <div className="text-2xl font-mono font-bold text-green-400 tracking-tight">
                  {lastExecutionSummary.p95LatencyMs}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    / {lastExecutionSummary.p99LatencyMs} ms
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>
                Breakdown:{' '}
                <span className="text-cyan-300 font-medium">
                  {lastExecutionSummary.leadersQueued} leader queued
                </span>
                ,{' '}
                <span className="text-amber-300 font-medium">
                  {lastExecutionSummary.duplicatesIntercepted} duplicates intercepted
                </span>{' '}
                (Total: {lastExecutionSummary.totalRequests} callers)
              </span>
              <span className="text-green-400 font-semibold">100% Exactly-Once Guaranteed</span>
            </div>
          </div>
        )}

        {/* Interactive Testing Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Card 1: Settlement Balance */}
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-wider">
                <DollarSign className="w-3.5 h-3.5 text-green-400" />
                Ledger Settlement Balance
              </div>
              <div className="text-3xl font-mono font-bold tracking-tight text-green-400">
                {balanceDisplay}
              </div>
              <p className="text-xs text-slate-400">
                Merchant: <span className="text-slate-200 font-medium">{merchantName}</span> •{' '}
                <span className="font-mono text-[11px] opacity-75">{merchant?.apiKey}</span>
              </p>
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>PostgreSQL Namespace</span>
              <span className="text-slate-200 font-semibold">task_engine</span>
            </div>
          </div>

          {/* Card 2: Scenario A (Sequential Idempotency / Cache Hit) */}
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-green-400 font-medium">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  SCENARIO A: CACHE HIT
                </span>
                <span className="text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                  Target: &lt; 5ms
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Sends Req 1 (leader queues work), awaits settlement, then immediately sends Req 2
                with identical key to verify instant Redis response cache hit.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunScenarioA}
              disabled={isSimulatingScenarioA}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors disabled:opacity-40"
            >
              <Zap
                className={cn(
                  'w-3.5 h-3.5 text-green-400',
                  isSimulatingScenarioA && 'animate-spin',
                )}
              />
              <span>Test Scenario A (Cache Hit)</span>
            </button>
          </div>

          {/* Card 3: Scenario B (Customizable Concurrent Collision Burst) */}
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <Layers className="w-3.5 h-3.5" />
                  SCENARIO B: BURST
                </span>
                <span className="text-xs font-mono text-cyan-300 font-bold">
                  {burstConcurrency}x callers
                </span>
              </div>
              <div className="my-1.5 space-y-1">
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={burstConcurrency}
                  onChange={(e) => setBurstConcurrency(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
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
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-semibold bg-slate-100 hover:bg-white text-slate-950 border border-slate-200 transition-colors disabled:opacity-40"
            >
              <Play
                className={cn('w-3.5 h-3.5 fill-current', isSimulatingBurst && 'animate-spin')}
              />
              <span>Fire {burstConcurrency}x Burst</span>
            </button>
          </div>

          {/* Card 4: Scenario C (Parametric Realistic Multi-Tenant Workload) */}
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  SCENARIO C: REALISTIC
                </span>
                <span className="text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                  {realisticVolume} items • {realisticDupRatio}% dups
                </span>
              </div>
              <div className="my-1.5 space-y-2">
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Volume</span>
                    <span>{realisticVolume} transactions</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="10"
                    value={realisticVolume}
                    onChange={(e) => setRealisticVolume(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">Duplicate Ratio</span>
                  <div className="flex items-center gap-1">
                    {[10, 25, 50].map((ratio) => {
                      const isSelected = realisticDupRatio === ratio;
                      let ratioPillClass =
                        'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60';
                      if (isSelected) {
                        ratioPillClass =
                          'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold';
                      }

                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setRealisticDupRatio(ratio)}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] transition-colors',
                            ratioPillClass,
                          )}
                        >
                          {ratio}%
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRunRealisticWorkload}
              disabled={isSimulatingRealistic}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors disabled:opacity-40"
            >
              <Sparkles
                className={cn('w-3.5 h-3.5 text-cyan-400', isSimulatingRealistic && 'animate-spin')}
              />
              <span>Run Realistic Workload</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: RPS */}
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] space-y-2">
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
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] space-y-2">
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
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
              <span>Latency (p95 / p99)</span>
              <Clock className="w-4 h-4 text-green-400" />
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
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] space-y-2">
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
                onClick={() => setIsReplayDlqConfirmOpen(true)}
                disabled={isReplayingDlq || metrics.activeDlqCount === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Replay All
              </button>
            </div>
            <div className="text-xs text-slate-400 font-mono">Retries Exhausted (&gt; 5)</div>
          </div>
        </div>

        {/* Chaos Engineering Switches */}
        <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
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
                'p-4 rounded-xl border text-left transition-colors flex items-start justify-between gap-3',
                flakyButtonClass,
              )}
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Downstream Bank Gateway Chaos</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-slate-800">
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
                'p-4 rounded-xl border text-left transition-colors flex items-start justify-between gap-3',
                dbLatencyButtonClass,
              )}
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>PostgreSQL Latency Spike Chaos</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-slate-800">
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

        {/* Two Columns with Visual Parity: Left = Ingestion & Audit • Right = Settled Financial Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Live Buffer & Idempotency Audit */}
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] flex flex-col h-[520px]">
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('live')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors text-slate-400 hover:text-slate-200',
                    activeTab === 'live' && 'bg-slate-800 text-slate-100 border border-slate-700',
                  )}
                >
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  Live Ingestion Feed
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('historical')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors text-slate-400 hover:text-slate-200',
                    activeTab === 'historical' &&
                      'bg-slate-800 text-slate-100 border border-slate-700',
                  )}
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  Idempotency Audit Log
                </button>
              </div>

              <span className="text-[11px] font-mono text-slate-400">
                {(() => {
                  if (activeTab === 'live') {
                    return 'Sub-second SSE Buffer';
                  }
                  return 'PostgreSQL Audit Trail';
                })()}
              </span>
            </div>

            {/* Sub-view 1: Live Ingestion Feed (Rolling window capped at 15) */}
            {activeTab === 'live' && (
              <div className="flex-1 min-h-0 flex flex-col justify-between">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                  {liveFeedItems.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                      <Activity className="w-6 h-6 opacity-30 animate-pulse" />
                      <p>Awaiting incoming webhook requests...</p>
                    </div>
                  )}

                  {liveFeedItems.map((item) => {
                    // Semantic Color Scheme:
                    // Green: Cache HIT
                    // Cyan: Leader (MISS)
                    // Amber: Concurrent HIT or Timeout waiting
                    // Rose: Errors / Dead letter
                    let badgeClass = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
                    let label = 'LEADER (MISS)';

                    if (item.cacheStatus === 'HIT') {
                      badgeClass = 'bg-green-500/10 text-green-400 border-green-500/25';
                      label = 'CACHED (HIT)';
                    }
                    if (item.cacheStatus === 'HIT_CONCURRENT') {
                      badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/25';
                      label = 'CONCURRENT HIT';
                    }
                    if (item.cacheStatus === 'TIMEOUT_CONCURRENT') {
                      badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                      label = 'TIMEOUT (WAITING)';
                    }

                    const { formatted, isNegative } = formatSignedCents(item.amountCents);
                    let amountColorClass = 'text-green-400';
                    if (isNegative) {
                      amountColorClass = 'text-rose-400';
                    }

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-slate-800 bg-[#161922] flex items-center justify-between gap-3"
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
                            <span className="text-slate-200 font-semibold">{item.eventType}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            Key: {item.idempotencyKey}
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div className={cn('font-medium', amountColorClass)}>{formatted}</div>
                          <div className="text-[10px] text-slate-400">{item.durationMs}ms</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer bar for visual parity */}
                <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
                  <span>Rolling Buffer: {liveFeedItems.length} of 15 max recent events</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('historical')}
                    className="text-slate-300 hover:text-white underline transition-colors"
                  >
                    View Full Audit History
                  </button>
                </div>
              </div>
            )}

            {/* Sub-view 2: Idempotency Audit Log */}
            {activeTab === 'historical' && (
              <div className="flex-1 min-h-0 flex flex-col justify-between">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                  {events.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                      <History className="w-6 h-6 opacity-30" />
                      <p>No historical events logged in database.</p>
                    </div>
                  )}

                  {events.map((evt) => {
                    // Semantic Color Scheme:
                    // Green: COMPLETED
                    // Amber: PENDING, PROCESSING
                    // Rose: DEAD_LETTER
                    let statusBadgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/25';
                    if (evt.status === 'COMPLETED') {
                      statusBadgeClass = 'bg-green-500/10 text-green-400 border-green-500/25';
                    }
                    if (evt.status === 'DEAD_LETTER') {
                      statusBadgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/25';
                    }

                    return (
                      <div
                        key={evt.id}
                        className="p-3 rounded-lg border border-slate-800 bg-[#161922] flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 truncate">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] border font-bold',
                                statusBadgeClass,
                              )}
                            >
                              {evt.status}
                            </span>
                            <span className="text-slate-200 font-semibold">{evt.eventType}</span>
                            <span className="text-[10px] text-slate-400">
                              ({evt.attempts} tries)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            Key: {evt.idempotencyKey}
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div className="text-slate-200 font-medium">{evt.reference}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(evt.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Events Pagination */}
                {eventsPagination &&
                  (() => {
                    let totalP = 1;
                    if (eventsPagination.totalPages > 0) {
                      totalP = eventsPagination.totalPages;
                    }
                    return (
                      <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 shrink-0">
                        <span>
                          Page {eventsPage} of {totalP} ({eventsPagination.total} total)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handlePrevEventsPage}
                            disabled={eventsPage <= 1 || isEventsLoading}
                            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={handleNextEventsPage}
                            disabled={eventsPage >= eventsPagination.totalPages || isEventsLoading}
                            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}
          </div>

          {/* Right Column: Settled Financial Ledger */}
          <div className="p-5 rounded-xl border border-slate-800 bg-[#11141D] flex flex-col h-[520px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-green-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Settled Ledger Transactions
                </h2>
              </div>
              <button
                type="button"
                onClick={handleRefreshTransactions}
                disabled={isTransactionsLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 hover:bg-slate-750 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3 h-3', isTransactionsLoading && 'animate-spin')} />
                Refresh
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col justify-between">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                {transactions.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                    <CheckCircle2 className="w-6 h-6 opacity-30" />
                    <p>No settled transactions recorded yet.</p>
                  </div>
                )}

                {transactions.map((tx) => {
                  const { formatted, isNegative } = formatSignedCents(tx.amountCents);
                  let amountColorClass = 'text-green-400';
                  if (isNegative) {
                    amountColorClass = 'text-rose-400';
                  }

                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-lg border border-slate-800 bg-[#161922] flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/25">
                            {tx.status}
                          </span>
                          <span className="text-slate-200 font-semibold">{tx.reference}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Event: {tx.eventType}
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className={cn('font-medium', amountColorClass)}>{formatted}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(tx.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {pagination &&
                (() => {
                  let displayTotalPages = 1;
                  if (pagination.totalPages > 0) {
                    displayTotalPages = pagination.totalPages;
                  }
                  return (
                    <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 shrink-0">
                      <span>
                        Page {page} of {displayTotalPages} ({pagination.total} total)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePrevPage}
                          disabled={page <= 1}
                          className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={handleNextPage}
                          disabled={page >= pagination.totalPages}
                          className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#11141D] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-mono gap-2">
          <span>Idempotent Task Engine</span>
          <span>Live Ingestion &amp; Resilience Telemetry</span>
        </div>
      </footer>
    </div>
  );
}
