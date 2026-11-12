import React, { useState } from 'react';
import type { KillSwitchState, KycCase, NorthgateView, PolicySettings, QueueMetrics } from '../shared/index';
import { formatDurationSec } from '../api';

interface ShellLayoutProps {
  activeView: NorthgateView;
  onNavigate: (view: NorthgateView) => void;
  activeCase: KycCase;
  allCases: KycCase[];
  onSelectCase: (caseId: string) => void;
  metrics: QueueMetrics;
  policy: PolicySettings;
  killSwitch: KillSwitchState;
  children: React.ReactNode;
}

export const ShellLayout: React.FC<ShellLayoutProps> = ({
  activeView,
  onNavigate,
  activeCase,
  allCases,
  onSelectCase,
  metrics,
  policy,
  killSwitch,
  children,
}) => {
  const [quickQuery, setQuickQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const openDeficiencies = activeCase.deficiencies.filter((d) => d.status !== 'REMEDIATED');
  const criticalDeficiencies = openDeficiencies.filter((d) => d.severity === 'CRITICAL_BLOCKER').length;
  const registryDiscrepancies = activeCase.registryChecks.filter(
    (r) => r.status === 'CRITICAL_MISMATCH' || r.status === 'WARNING_PENDING'
  ).length;
  const processingCount = metrics.statusCounts.Processing || 0;

  const quickResults = quickQuery.trim()
    ? allCases.filter((c) => {
        const q = quickQuery.toLowerCase();
        return (
          c.id.toLowerCase().includes(q) ||
          c.entityName.toLowerCase().includes(q) ||
          c.identifierValue.toLowerCase().includes(q) ||
          c.ownershipNodes.some((n) => n.name.toLowerCase().includes(q))
        );
      })
    : [];

  const navItems: Array<{
    id: NorthgateView;
    label: string;
    icon: string;
    badge?: string;
    badgeStyle?: 'default' | 'primary' | 'danger';
  }> = [
    {
      id: 'intake-queue',
      label: 'Intake Queue',
      icon: 'move_to_inbox',
      badge: String(metrics.activeQueueCount),
      badgeStyle: 'default',
    },
    {
      id: 'processing-state',
      label: 'Processing State',
      icon: 'hourglass_top',
      badge: `${processingCount} active`,
      badgeStyle: 'default',
    },
    {
      id: 'ownership-workbench',
      label: 'Ownership Workbench',
      icon: 'account_tree',
      badge: 'Primary',
      badgeStyle: 'primary',
    },
    {
      id: 'registry-reconciliation',
      label: 'Registry Reconciliation',
      icon: 'sync_alt',
      badge: registryDiscrepancies > 0 ? `${registryDiscrepancies} Discrepancy` : 'Synced',
      badgeStyle: registryDiscrepancies > 0 ? 'danger' : 'default',
    },
    {
      id: 'document-viewer',
      label: 'Document Viewer',
      icon: 'description',
      badge: 'Extracted',
      badgeStyle: 'default',
    },
    {
      id: 'deficiency-punch-list',
      label: 'Deficiency Punch List',
      icon: 'rule',
      badge: criticalDeficiencies > 0 ? `${criticalDeficiencies} Critical` : `${openDeficiencies.length} Open`,
      badgeStyle: criticalDeficiencies > 0 ? 'danger' : 'default',
    },
    {
      id: 'audit-trail',
      label: 'Audit Trail',
      icon: 'history_edu',
      badge: activeCase.auditLocked ? 'Locked' : 'Live',
      badgeStyle: 'default',
    },
  ];

  const statusDotColor =
    activeCase.status === 'Verified / Cleared'
      ? 'bg-emerald-600'
      : activeCase.status === 'Deficiencies Pending'
        ? 'bg-error'
        : activeCase.status === 'Processing'
          ? 'bg-amber-500 animate-pulse'
          : 'bg-secondary';

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Top Institutional Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-surface-container-lowest border-b border-slate-200 z-50 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onNavigate('intake-queue')}
            className="flex items-center gap-2 text-left shrink-0"
          >
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-on-primary font-semibold text-sm">
              N
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[15px] tracking-tight text-on-surface whitespace-nowrap">
                Project Northgate
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                <span className="material-symbols-outlined text-[12px]">verified_user</span>
                {policy.fedRampEnclaveMode === 'FEDRAMP_HIGH' ? 'FedRAMP High' : 'SOC 2 Strict'}
              </span>
            </div>
          </button>

          <div className="hidden lg:block h-6 w-px bg-slate-200 shrink-0" />

          <div className="hidden lg:flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Case ID:
              </span>
              <span className="font-mono text-[12px] bg-surface-container-low px-1.5 py-0.5 rounded text-on-surface font-semibold">
                {activeCase.id}
              </span>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant shrink-0">
                Entity:
              </span>
              <span className="font-semibold text-[14px] text-on-surface truncate max-w-[210px]">
                {activeCase.entityName}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-low text-on-surface text-[11px] font-semibold shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
              <span>{activeCase.status}</span>
            </div>

            <div className="hidden xl:flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-low font-mono text-[11px] text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[14px]">timer</span>
              <span>Cycle Time: {formatDurationSec(activeCase.cycleTimeSec)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={quickQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Quick search entity, UBO, LEI..."
              className="w-56 md:w-64 h-8 pl-8 pr-3 bg-surface-container-low border border-slate-200 rounded text-[12px] text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-secondary focus:bg-white"
            />
            {searchFocused && quickQuery.trim() !== '' && (
              <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-300 rounded shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-1.5 bg-surface-container-low text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Matching Cases ({quickResults.length})
                </div>
                {quickResults.length === 0 ? (
                  <div className="px-3 py-3 text-[12px] text-on-surface-variant">
                    No cases or UBOs matched "{quickQuery}".
                  </div>
                ) : (
                  quickResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => {
                        onSelectCase(c.id);
                        setQuickQuery('');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-surface-container-low border-t border-slate-100 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[12px] text-on-surface truncate">{c.entityName}</div>
                        <div className="font-mono text-[11px] text-on-surface-variant">
                          {c.id} • {c.jurisdiction}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-container text-secondary shrink-0">
                        Select
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="font-semibold text-[12px] text-on-surface leading-tight">Marcus Vance</div>
              <div className="text-[10px] font-medium text-on-surface-variant leading-tight">KYC Senior Analyst</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Left Sidebar Rail */}
      <aside className="fixed left-0 top-14 bottom-7 w-60 bg-surface-container-lowest border-r border-slate-200 z-40 flex flex-col justify-between py-2.5">
        <div className="px-2 flex flex-col gap-1">
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Operational Queue
          </div>
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              let badgeClasses = 'bg-surface-container-high text-on-surface';
              if (item.badgeStyle === 'primary') {
                badgeClasses = 'bg-secondary-container text-on-secondary-container';
              } else if (item.badgeStyle === 'danger') {
                badgeClasses = 'bg-error-container text-on-error-container';
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[12.5px] transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[18px] shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                        isActive && item.badgeStyle === 'default'
                          ? 'bg-white/15 text-white'
                          : badgeClasses
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active Case Switcher */}
          <div className="mt-4 px-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
              Active Case Context
            </div>
            <select
              value={activeCase.id}
              onChange={(e) => onSelectCase(e.target.value)}
              className="w-full h-8 px-2 bg-surface-container-low border border-slate-200 rounded text-[11.5px] font-medium text-on-surface focus:outline-none focus:border-secondary"
            >
              {allCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.entityName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onNavigate('settings-policy')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[12.5px] transition-colors ${
              activeView === 'settings-policy'
                ? 'bg-primary-container text-on-primary font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">policy</span>
              <span>Settings & Policy</span>
            </div>
            <span className="material-symbols-outlined text-[14px]">lock</span>
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <div className="pl-60 pt-14 pb-8 flex-1">
        {killSwitch.active && (
          <div className="bg-error text-white px-4 py-2 text-[12px] font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">emergency_home</span>
              <span>
                EMERGENCY KILL SWITCH ENGAGED: {killSwitch.reason || 'Worker execution and outbound notifications frozen.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('settings-policy')}
              className="px-2.5 py-0.5 rounded bg-white text-error text-[11px] font-semibold"
            >
              Manage Circuit Breaker
            </button>
          </div>
        )}
        <main className="w-full">{children}</main>
      </div>

      {/* Bottom Institutional Status Footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-7 bg-surface-container-lowest border-t border-slate-200 z-40 px-4 flex items-center justify-between text-[11px] text-on-surface-variant">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-on-surface">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Institutional KYC Workbench • Live Full-Stack TypeScript Engine
          </span>
          <span className="hidden md:flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            GLEIF Sync: Operational
          </span>
          <span className="hidden lg:flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Companies House API: Responding ({activeCase.registryLatencyMs || 112}ms)
          </span>
          <span className="hidden xl:flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Dow Jones Risk & Compliance v2024.10: Active
          </span>
        </div>
        <div className="font-mono text-[10.5px] text-on-surface-variant">
          Traceability Engine v4.2
        </div>
      </footer>
    </div>
  );
};
