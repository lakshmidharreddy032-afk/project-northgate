import React, { useState } from 'react';
import type { KycCase, NorthgateView } from '../shared/index';

interface ProcessingStateViewProps {
  activeCase: KycCase;
  onAdvance: () => Promise<void>;
  onAbort: () => Promise<void>;
  onRetry: () => Promise<void>;
  onRunAgent: () => Promise<void>;
  onApproveAgentGate: (runId: string, justification: string) => Promise<void>;
  onNavigate: (view: NorthgateView) => void;
}

export const ProcessingStateView: React.FC<ProcessingStateViewProps> = ({
  activeCase,
  onAdvance,
  onAbort,
  onRetry,
  onRunAgent,
  onApproveAgentGate,
  onNavigate,
}) => {
  const [agentJustification, setAgentJustification] = useState(
    'Verified 7-step agentic KYC findings; approve RM remediation notice.'
  );
  const [runningAgent, setRunningAgent] = useState(false);

  const { pipeline } = activeCase;
  const completedCount = pipeline.workers.filter((w) => w.status === 'COMPLETE').length;
  const progressPct = Math.round((completedCount / pipeline.workers.length) * 100);
  const isRunning = pipeline.workers.some((w) => w.status === 'RUNNING' || w.status === 'QUEUED');
  const latestRun = activeCase.agentRuns?.[0];

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Top Pipeline Banner */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded bg-primary text-on-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold text-[16px] text-on-surface">
                Ingesting Onboarding Dossier
              </h1>
              <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-mono text-[10.5px] font-semibold uppercase">
                {pipeline.tierLabel}
              </span>
            </div>
            <div className="text-[12px] text-on-surface-variant mt-0.5">
              <strong className="text-on-surface">{activeCase.entityName}</strong> • {activeCase.id} • Submitted by{' '}
              {pipeline.submittedBy} ({pipeline.submittedAgoLabel})
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-low font-mono text-[11px] text-on-surface-variant">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              ENGINE CLUSTER: {pipeline.clusterNode}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={runningAgent}
            onClick={async () => {
              setRunningAgent(true);
              try {
                await onRunAgent();
              } finally {
                setRunningAgent(false);
              }
            }}
            className="h-8 px-3 rounded bg-secondary text-white font-semibold text-[12px] flex items-center gap-1.5 hover:bg-secondary-container"
          >
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            <span>{runningAgent ? 'Running Agent...' : 'Run Agentic AI Workflow'}</span>
          </button>
          {isRunning ? (
            <>
              <button
                type="button"
                onClick={() => void onAdvance()}
                className="h-8 px-3 rounded bg-secondary text-white font-semibold text-[12px] flex items-center gap-1.5 hover:bg-secondary-container"
              >
                <span className="material-symbols-outlined text-[16px]">fast_forward</span>
                <span>Advance Next Worker</span>
              </button>
              <button
                type="button"
                onClick={() => void onAbort()}
                className="h-8 px-3 rounded border border-red-200 bg-error-container/40 text-error font-semibold text-[12px] flex items-center gap-1.5 hover:bg-error-container"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Abort Intake</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void onRetry()}
              className="h-8 px-3 rounded border border-slate-200 bg-surface-container-low text-on-surface font-semibold text-[12px] flex items-center gap-1.5 hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[16px]">replay</span>
              <span>Re-run Pipeline</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('ownership-workbench')}
            className="h-8 px-3 rounded bg-primary text-on-primary font-semibold text-[12px] flex items-center gap-1.5 hover:bg-primary-container"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            <span>View Results in Workbench</span>
          </button>
        </div>
      </div>

      {/* DAG Execution Graph */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] font-semibold uppercase text-secondary">
                DAG Execution Graph
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-low font-mono text-[10.5px] text-on-surface-variant">
                v2.4 Orchestrator
              </span>
            </div>
            <h2 className="font-semibold text-[15px] text-on-surface mt-0.5">
              Parallel Intake &amp; Extraction Workers
            </h2>
          </div>
          {pipeline.retryNotice && (
            <div className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11.5px] font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">schedule</span>
              <span>{pipeline.retryNotice}</span>
            </div>
          )}
        </div>

        {/* Task Dispatch Root */}
        <div className="flex justify-center">
          <div className="px-5 py-2.5 rounded bg-surface-container-low border border-slate-200 text-center">
            <div className="flex items-center justify-center gap-1.5 font-semibold text-[13px] text-on-surface">
              <span className="material-symbols-outlined text-[16px] text-secondary">account_tree</span>
              <span>Task Dispatch</span>
            </div>
            <div className="font-mono text-[11px] text-on-surface-variant mt-0.5">
              Pipeline: {pipeline.pipelineId} • Client: <strong>{activeCase.entityName}</strong>
            </div>
          </div>
        </div>

        {/* 4 Worker Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {pipeline.workers.map((w) => {
            const isActive = w.status === 'RUNNING';
            return (
              <div
                key={w.id}
                className={`p-3 rounded border flex flex-col justify-between gap-2 ${
                  isActive
                    ? 'border-secondary bg-[#f0f7ff] ring-1 ring-secondary/20'
                    : 'border-slate-200 bg-surface-container-lowest'
                }`}
              >
                <div>
                  <div className="font-semibold text-[13px] text-on-surface">{w.name}</div>
                  <p className="text-[11.5px] text-on-surface-variant mt-1">{w.description}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <WorkerBadge status={w.status} />
                  <span className="font-mono text-[11px] text-on-surface-variant">
                    {w.status === 'QUEUED' ? 'Pending' : `${w.elapsedSec}s elapsed`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-1">
          <div className="flex items-center justify-between text-[11.5px] font-mono mb-1">
            <span>
              WORKER PROGRESS: <strong>Overall: {completedCount} of {pipeline.workers.length} complete</strong> ({progressPct}%)
            </span>
            <span className="text-on-surface-variant">
              Elapsed {Math.floor(pipeline.elapsedSec / 60)}m {pipeline.elapsedSec % 60}s of {pipeline.targetSlaSec}s target
            </span>
          </div>
          <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div
              className="h-full bg-secondary transition-all duration-300"
              style={{ width: `${Math.max(progressPct, 8)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Split: Execution Stepper + Dark Terminal Stream */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Left: Execution Stepper */}
        <div className="xl:col-span-7 bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Execution Stepper &amp; Task Details
              </div>
              <h3 className="font-semibold text-[15px] text-on-surface">
                Automated Intake &amp; Extraction Pipeline
              </h3>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {pipeline.phases.map((ph) => (
              <div key={ph.phaseNumber} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] ${
                      ph.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : ph.status === 'ACTIVE'
                          ? 'bg-secondary text-white animate-pulse'
                          : 'bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {ph.status === 'COMPLETED' ? 'check' : ph.status === 'ACTIVE' ? 'sync' : 'schedule'}
                    </span>
                  </div>
                  {ph.phaseNumber < pipeline.phases.length && (
                    <div className="w-px flex-1 bg-slate-200 my-1" />
                  )}
                </div>

                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-semibold text-[13px] text-on-surface">
                      <span className="font-mono text-[11px] text-secondary mr-1.5">
                        PHASE 0{ph.phaseNumber}
                      </span>
                      {ph.title}
                    </div>
                    <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant">
                      {ph.durationLabel} • {ph.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-on-surface-variant mt-1">{ph.summary}</p>
                  {ph.tags && ph.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ph.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded bg-surface-container-low border border-slate-200 font-mono text-[10.5px] text-on-surface"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {ph.warningBanner && (
                    <div className="mt-1.5 px-2.5 py-1.5 rounded bg-error-container/50 border border-red-200 text-on-error-container text-[11.5px] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">warning</span>
                      <span>{ph.warningBanner}</span>
                    </div>
                  )}
                  {ph.traceNodes && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {ph.traceNodes.map((tn, idx) => (
                        <React.Fragment key={tn.label}>
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10.5px] ${
                              tn.highlight
                                ? 'bg-secondary-fixed text-on-secondary-fixed font-semibold'
                                : 'bg-surface-container-low text-on-surface'
                            }`}
                          >
                            {tn.label}
                          </span>
                          {idx < ph.traceNodes!.length - 1 && (
                            <span className="text-on-surface-variant">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dark Engine Telemetry Terminal + Live Grounding */}
        <div className="xl:col-span-5 flex flex-col gap-3">
          <div className="bg-[#0b1524] text-slate-200 rounded border border-slate-800 overflow-hidden">
            <div className="px-3 py-2 bg-[#07101d] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="ml-1">ENGINE_LOG :: NORTHGATE_INTAKE</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-emerald-400">
                {isRunning ? 'STREAMING' : 'COMPLETE'}
              </span>
            </div>

            <div className="p-3 font-mono text-[11.5px] leading-relaxed flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {pipeline.engineLogs.map((log, i) => (
                <div
                  key={`${log.timestamp}-${i}`}
                  className={
                    log.level === 'ERROR'
                      ? 'bg-red-950/60 border border-red-800/60 text-red-200 px-2 py-1 rounded'
                      : log.level === 'WARN'
                        ? 'text-amber-300'
                        : 'text-slate-300'
                  }
                >
                  <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-slate-200 rounded p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
              <span>Live Evidentiary Grounding</span>
              <span className="font-mono">{pipeline.liveGrounding.pageLabel}</span>
            </div>
            <div className="p-2.5 rounded bg-surface-container-low border border-slate-200">
              <div className="flex items-center justify-between text-[12px] font-semibold text-secondary">
                <span>{pipeline.liveGrounding.fileName}</span>
                <span className="font-mono text-[11px]">{pipeline.liveGrounding.clauseLabel}</span>
              </div>
              <p className="italic text-[12px] text-on-surface mt-1.5">
                "{pipeline.liveGrounding.excerpt}"
              </p>
              <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-on-surface-variant">
                <span>Confidence: {pipeline.liveGrounding.confidencePct}%</span>
                <button
                  type="button"
                  onClick={() => onNavigate('document-viewer')}
                  className="text-secondary font-semibold hover:underline"
                >
                  Inspect Source →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agentic AI Workflow Execution Trace */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] font-semibold uppercase text-secondary">
                Bounded Agentic AI Workflow
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[10.5px] text-on-surface">
                Plan → OCR → MCP Tools → UBO Guardrail → AI Triage → Human Gate
              </span>
            </div>
            <h3 className="font-semibold text-[15px] text-on-surface mt-0.5">
              Autonomous KYC Verification Trace {latestRun ? `(${latestRun.runId})` : ''}
            </h3>
          </div>
          {latestRun && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-surface-container-low font-mono text-[11px] text-on-surface-variant">
                UBO Modified: <strong>False</strong>
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                  latestRun.gateStatus === 'APPROVED_BY_ANALYST'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : latestRun.gateStatus === 'BLOCKED_KILL_SWITCH'
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                {latestRun.gateStatus.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </div>

        {!latestRun ? (
          <div className="p-4 text-center text-[12px] text-on-surface-variant bg-surface-container-low rounded">
            No agentic workflow run recorded yet for {activeCase.id}. Click <strong>Run Agentic AI Workflow</strong> above to execute the 7-step loop.
          </div>
        ) : (
          <>
            <div className="p-2.5 rounded bg-surface-container-low border border-slate-200 text-[12px] text-on-surface">
              <strong>Agent Synthesis:</strong> {latestRun.summary}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {latestRun.steps.map((step) => (
                <div
                  key={step.stepNumber}
                  className={`p-3 rounded border flex flex-col gap-1.5 ${
                    step.status === 'AWAITING_APPROVAL'
                      ? 'border-amber-300 bg-amber-50/50'
                      : step.status === 'BLOCKED'
                        ? 'border-red-300 bg-red-50/50'
                        : step.status === 'WARNING'
                          ? 'border-secondary/40 bg-[#f0f7ff]'
                          : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] font-semibold uppercase text-secondary">
                      Step 0{step.stepNumber} • {step.kind}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant">{step.durationMs}ms</span>
                  </div>
                  <div className="font-semibold text-[12.5px] text-on-surface">{step.title}</div>
                  {step.toolName && (
                    <div className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface w-fit">
                      {step.toolName}
                    </div>
                  )}
                  <p className="text-[11px] text-on-surface-variant">{step.thought}</p>
                  <div className="mt-auto pt-1.5 border-t border-slate-100 text-[11px] font-medium text-on-surface">
                    {step.observation}
                  </div>
                </div>
              ))}
            </div>

            {latestRun.gateStatus === 'AWAITING_ANALYST_APPROVAL' && (
              <div className="p-3 rounded bg-surface-container-low border border-secondary/30 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                <div className="flex-1">
                  <div className="text-[11px] font-semibold uppercase text-secondary mb-1">
                    Human-in-the-Loop Gate Approval (Mandatory Regulatory Justification)
                  </div>
                  <input
                    type="text"
                    value={agentJustification}
                    onChange={(e) => setAgentJustification(e.target.value)}
                    className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded text-[12px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void onApproveAgentGate(latestRun.runId, agentJustification)}
                  className="h-8 px-3.5 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold shrink-0 md:mt-5"
                >
                  Approve Gate &amp; Dispatch mcp://notifications
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const WorkerBadge: React.FC<{ status: KycCase['pipeline']['workers'][number]['status'] }> = ({
  status,
}) => {
  if (status === 'COMPLETE') {
    return (
      <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-semibold">
        ✓ Complete
      </span>
    );
  }
  if (status === 'RUNNING') {
    return (
      <span className="px-2 py-0.5 rounded bg-secondary text-white text-[10.5px] font-semibold">
        ● Running
      </span>
    );
  }
  if (status === 'ABORTED') {
    return (
      <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container text-[10.5px] font-semibold">
        Aborted
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant text-[10.5px] font-semibold">
      Queued
    </span>
  );
};
