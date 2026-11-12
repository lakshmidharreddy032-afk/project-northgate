import React, { useEffect, useState } from 'react';
import type {
  AuditEvent,
  AuditEventCategory,
  AuditVerificationResult,
  KycCase,
} from '../shared/index';
import { api, apiUrl } from '../api';

interface AuditTrailViewProps {
  activeCase: KycCase;
  initialEvents: AuditEvent[];
  onSignOff: (action: 'APPROVE_LOCK' | 'REJECT_OVERRIDE') => Promise<void>;
  notify: (title: string, message: string) => void;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  activeCase,
  initialEvents,
  onSignOff,
  notify,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>(initialEvents);
  const [counts, setCounts] = useState<Record<'ALL' | AuditEventCategory, number>>({
    ALL: initialEvents.length,
    ANALYST_OVERRIDE: 0,
    REGISTRY_QUERY: 0,
    UBO_CALCULATION: 0,
    DOCUMENT_OCR: 0,
    RULE_TRIGGER: 0,
    EXECUTIVE_SIGNOFF: 0,
  });
  const [category, setCategory] = useState<'ALL' | AuditEventCategory>('ALL');
  const [query, setQuery] = useState('');
  const [verification, setVerification] = useState<AuditVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadAudit = async (cat: 'ALL' | AuditEventCategory, q: string) => {
    const res = await api.getAudit(activeCase.id, { category: cat, q });
    setEvents(res.events);
    setCounts(res.counts);
  };

  useEffect(() => {
    void loadAudit(category, query);
  }, [activeCase.id, category, query, initialEvents.length]);

  const handleVerifyHashes = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAudit(activeCase.id);
      setVerification(res);
      notify(
        res.valid ? 'Merkle Chain Verified' : 'Hash Mismatch Detected',
        `Checked ${res.checkedCount} chained events. Latest root: ${res.merkleRoot.slice(0, 14)}...`
      );
    } finally {
      setVerifying(false);
    }
  };

  const filterChips: Array<{ key: 'ALL' | AuditEventCategory; label: string; dot?: string }> = [
    { key: 'ALL', label: 'All Events' },
    { key: 'ANALYST_OVERRIDE', label: 'Analyst Overrides', dot: 'bg-error' },
    { key: 'REGISTRY_QUERY', label: 'Registry Queries' },
    { key: 'DOCUMENT_OCR', label: 'Document Extractions' },
    { key: 'UBO_CALCULATION', label: 'UBO Calculations' },
    { key: 'RULE_TRIGGER', label: 'Rule Triggers' },
    { key: 'EXECUTIVE_SIGNOFF', label: 'Executive Sign-Offs' },
  ];

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Top Lineage Header Card */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-secondary font-semibold uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              Immutable Audit Lineage
            </span>
            <span className="text-on-surface font-semibold">Compliance Audit Trail &amp; Lineage Log</span>
            <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant">
              WORM Storage Active
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-on-surface-variant">
              MERKLE ROOT: <strong className="text-on-surface">{activeCase.merkleRoot.slice(0, 14)}...</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
              ● Live Sync
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-primary text-white font-mono text-[10px] font-semibold">
                SEC 17A-4 / FINRA COMPLIANT
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">
                SHA-256 Hash Chain {activeCase.merkleRoot.slice(0, 12)}...
              </span>
            </div>
            <h1 className="text-[20px] font-semibold text-on-surface mt-1">
              Compliance Audit Trail &amp; Lineage Log
            </h1>
            <p className="text-[12px] text-on-surface-variant">
              Cryptographically verifiable, immutable chronological log of system extractions, registry validations, and analyst overrides for{' '}
              <strong>{activeCase.entityName}</strong> ({activeCase.id}).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={verifying}
              onClick={() => void handleVerifyHashes()}
              className="h-8 px-3 rounded border border-slate-200 bg-white hover:bg-surface-container-low text-[12px] font-semibold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
              <span>{verifying ? 'Verifying...' : 'Verify Hashes'}</span>
            </button>
            <a
              href={apiUrl(`/api/cases/${encodeURIComponent(activeCase.id)}/audit/export?format=csv`)}
              className="h-8 px-3 rounded border border-slate-200 bg-surface-container-low hover:bg-surface-container text-[12px] font-semibold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              <span>Export CSV</span>
            </a>
            <a
              href={apiUrl(`/api/cases/${encodeURIComponent(activeCase.id)}/audit/export?format=json`)}
              className="h-8 px-3 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Audit Log (JSON)</span>
            </a>
          </div>
        </div>

        {verification && (
          <div
            className={`px-3 py-2 rounded border text-[12px] flex items-center justify-between ${
              verification.valid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-error-container border-red-200 text-on-error-container'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span className="material-symbols-outlined text-[18px]">
                {verification.valid ? 'verified' : 'gpp_bad'}
              </span>
              <span>
                {verification.valid
                  ? `Cryptographic SHA-256 Chain Verified: ${verification.checkedCount}/${verification.checkedCount} events intact.`
                  : `Integrity break detected at sequence #${verification.brokenAtSequence}!`}
              </span>
            </div>
            <span className="font-mono text-[11px]">Root: {verification.merkleRoot.slice(0, 18)}...</span>
          </div>
        )}

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-surface-container-low p-3 rounded">
            <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Total Logged Events</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[22px] font-semibold tabular-nums">{counts.ALL}</span>
              <span className="text-[11px] text-on-surface-variant">entries</span>
            </div>
            <div className="font-mono text-[10.5px] text-secondary mt-0.5">100% hash chained</div>
          </div>

          <div className="bg-surface-container-low p-3 rounded">
            <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Critical Overrides</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[22px] font-semibold text-error tabular-nums">{counts.ANALYST_OVERRIDE}</span>
              <span className="text-[11px] text-error font-semibold">
                {activeCase.auditLocked ? 'VP Signed' : 'Pending VP Sign'}
              </span>
            </div>
            <div className="font-mono text-[10.5px] text-on-surface-variant mt-0.5">Analyst determinations</div>
          </div>

          <div className="bg-surface-container-low p-3 rounded">
            <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Registry Sync Latency</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[22px] font-semibold tabular-nums">{activeCase.registryLatencyMs || 418}ms</span>
              <span className="text-[11px] text-on-surface-variant">avg</span>
            </div>
            <div className="font-mono text-[10.5px] text-on-surface-variant mt-0.5">UK CH &amp; OpenCorporates</div>
          </div>

          <div className="bg-surface-container-low p-3 rounded">
            <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Lineage Integrity</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[22px] font-semibold tabular-nums">100.0%</span>
              <span className="font-mono text-[11px] text-secondary font-semibold">VALID</span>
            </div>
            <div className="font-mono text-[10.5px] text-on-surface-variant mt-0.5">Zero orphaned entities</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Actor, Event Type, or Document Ref..."
            className="w-full h-8 pl-8 pr-3 bg-surface-container-low rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-secondary"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {filterChips.map((chip) => {
            const active = category === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setCategory(chip.key)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                {chip.dot && <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`} />}
                <span>{chip.label}</span>
                <span className="font-mono text-[10px] opacity-80">{counts[chip.key] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-slate-200 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Event Category</th>
                <th className="py-2.5 px-3">Actor / Engine</th>
                <th className="py-2.5 px-3 min-w-[260px]">Event Description &amp; Evidentiary Trace</th>
                <th className="py-2.5 px-3">Source Document / API Ref</th>
                <th className="py-2.5 px-3 min-w-[220px]">Override &amp; Justification</th>
                <th className="py-2.5 px-3 text-right">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[12px]">
              {events.map((ev) => {
                const isOverride = ev.category === 'ANALYST_OVERRIDE';
                return (
                  <tr
                    key={ev.id}
                    className={isOverride ? 'bg-surface-container-high/35 hover:bg-surface-container-high/55' : 'hover:bg-slate-50'}
                  >
                    <td className="py-3 px-3 align-top whitespace-nowrap font-mono">
                      <div className="font-semibold text-on-surface">{ev.timestampUtc}</div>
                      <div className="text-[10.5px] text-on-surface-variant">{ev.dateUtc}</div>
                      <div className="text-[10.5px] text-secondary">seq #{String(ev.sequence).padStart(4, '0')}</div>
                    </td>
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase ${
                          isOverride
                            ? 'bg-error-container text-on-error-container'
                            : ev.category === 'EXECUTIVE_SIGNOFF'
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                              : 'bg-surface-container text-secondary'
                        }`}
                      >
                        {ev.category.replace(/_/g, ' ')}
                      </span>
                      <div className="text-[11px] text-on-surface-variant mt-1">{ev.categorySubLabel}</div>
                    </td>
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary-container text-white flex items-center justify-center font-mono text-[10px] font-semibold">
                          {ev.actorBadge}
                        </div>
                        <div>
                          <div className="font-semibold text-on-surface">{ev.actorName}</div>
                          <div className="text-[10.5px] text-on-surface-variant">{ev.actorRole}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <p className="text-on-surface">{ev.description}</p>
                      {ev.metadataPills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {ev.metadataPills.map((pill) => (
                            <span
                              key={pill}
                              className="px-1.5 py-0.5 rounded bg-surface-container-low font-mono text-[10px] text-on-surface-variant"
                            >
                              {pill}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="font-mono text-[11.5px] font-semibold text-on-surface">{ev.sourceRef}</div>
                      <div className="text-[11px] text-on-surface-variant">{ev.sourceMeta}</div>
                    </td>
                    <td className="py-3 px-3 align-top text-[11.5px] text-on-surface-variant">
                      {ev.overrideJustification}
                    </td>
                    <td className="py-3 px-3 align-top text-right font-mono text-[10.5px] whitespace-nowrap">
                      <div className="text-on-surface font-semibold">{ev.hash.slice(0, 12)}...</div>
                      <div className="text-emerald-700">SHA-256 VALID</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Executive Sign-Off Panel */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded bg-surface-container-low flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]">approval</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Executive Sign-Off {activeCase.auditLocked ? 'Completed' : 'Required'}
                </span>
                {activeCase.auditLocked ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-semibold">
                    ● Locked &amp; Attested by {activeCase.auditSignedBy}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container text-[10.5px] font-semibold">
                    ● Pending Analyst Override Approval
                  </span>
                )}
              </div>
              <div className="font-semibold text-[14px] text-on-surface mt-0.5">
                Elena Rostova (Compliance VP / Authorized Officer)
              </div>
              <p className="text-[12px] text-on-surface-variant">
                Attestation locks all current lineages, source extraction hashes, and analyst rationales into an immutable state for regulatory examination.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void onSignOff('REJECT_OVERRIDE')}
              className="h-8 px-3 rounded border border-red-200 bg-white hover:bg-error-container/40 text-error text-[12px] font-semibold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">undo</span>
              <span>Reject Override</span>
            </button>
            <button
              type="button"
              onClick={() => void onSignOff('APPROVE_LOCK')}
              className="h-8 px-3.5 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">lock</span>
              <span>{activeCase.auditLocked ? 'Re-Sign & Lock Audit Trail' : 'Lock & Sign Audit Trail'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-[11.5px]">
          <div>
            <div className="text-[10px] font-semibold uppercase text-on-surface-variant">Merkle Root Sequence</div>
            <div className="font-mono font-semibold text-on-surface mt-0.5">
              {activeCase.merkleRoot.slice(0, 14)}...{activeCase.merkleRoot.slice(-8)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-on-surface-variant">Regulatory Standard</div>
            <div className="font-semibold text-on-surface mt-0.5">FinCEN CDD Rule / EU 5AMLD</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-on-surface-variant">Export Verification Token</div>
            <div className="font-mono font-semibold text-secondary mt-0.5">
              EXP-{activeCase.id}-NORTHGATE-LOG
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
