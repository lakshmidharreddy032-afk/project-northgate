import React, { useState } from 'react';
import { apiUrl } from '../api';
import type { KycCase, NorthgateView, RegistryFieldCheck } from '../shared/index';

interface RegistryReconciliationViewProps {
  activeCase: KycCase;
  onRefreshRegistry: () => Promise<void>;
  onAcceptField: (fieldId: string) => Promise<void>;
  onAcceptAllVerified: () => Promise<void>;
  onCreateDeficiency: (fieldId: string) => Promise<void>;
  onNavigate: (view: NorthgateView) => void;
}

export const RegistryReconciliationView: React.FC<RegistryReconciliationViewProps> = ({
  activeCase,
  onRefreshRegistry,
  onAcceptField,
  onAcceptAllVerified,
  onCreateDeficiency,
  onNavigate,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'discrepancies' | 'resolved'>('all');
  const [compact, setCompact] = useState(false);

  const defaultFocus =
    activeCase.registryChecks.find((r) => r.status === 'CRITICAL_MISMATCH') ??
    activeCase.registryChecks.find((r) => r.status === 'WARNING_PENDING') ??
    activeCase.registryChecks[0];
  const [selectedFieldId, setSelectedFieldId] = useState<string>(defaultFocus?.id ?? '');

  const fields = activeCase.registryChecks;
  const perfectMatches = fields.filter(
    (f) => f.status === 'EXACT_MATCH' || f.status === 'VERIFIED' || f.status === 'ACTIVE_LEI' || f.status === 'ACCEPTED_BY_ANALYST'
  );
  const warnings = fields.filter((f) => f.status === 'WARNING_PENDING' || f.status === 'INDIRECT_LAYER');
  const criticals = fields.filter((f) => f.status === 'CRITICAL_MISMATCH');

  const visibleFields = fields.filter((f) => {
    if (filterMode === 'discrepancies') {
      return f.status === 'CRITICAL_MISMATCH' || f.status === 'WARNING_PENDING' || f.status === 'INDIRECT_LAYER';
    }
    if (filterMode === 'resolved') {
      return f.status === 'EXACT_MATCH' || f.status === 'VERIFIED' || f.status === 'ACTIVE_LEI' || f.status === 'ACCEPTED_BY_ANALYST';
    }
    return true;
  });

  const focusField = fields.find((f) => f.id === selectedFieldId) ?? defaultFocus;

  return (
    <div className="p-4 flex flex-col gap-3 pb-16">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase text-on-surface-variant">
            <span>KYC Onboarding</span>
            <span>›</span>
            <span>{activeCase.id}</span>
            <span>›</span>
            <span className="text-secondary font-semibold">Public Company Registry Reconciliation</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            <h1 className="text-[20px] font-semibold text-on-surface tracking-tight">
              Public Company Registry Reconciliation
            </h1>
            {criticals.length > 0 ? (
              <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container text-[10.5px] font-semibold uppercase">
                Action Required
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-semibold uppercase">
                Reconciled
              </span>
            )}
          </div>
          <p className="text-[12px] text-on-surface-variant mt-0.5">
            Cross-verification between customer onboarding packet and official public company registries (UK Companies House, OpenCorporates, GLEIF).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onRefreshRegistry()}
            className="h-8 px-3 rounded bg-white border border-slate-200 hover:bg-surface-container-low text-[12px] font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Force Refresh API</span>
          </button>
          <button
            type="button"
            onClick={() => void onAcceptAllVerified()}
            className="h-8 px-3 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            <span>Batch Accept Matches ({perfectMatches.length})</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded p-3">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Total Fields</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-[24px] font-semibold tabular-nums">{fields.length}</span>
            <span className="text-[11px] text-on-surface-variant">100% Ingested</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-3">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Perfect Matches</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-[24px] font-semibold tabular-nums">{perfectMatches.length}</span>
            <span className="text-[11px] text-secondary font-semibold">
              {fields.length > 0 ? Math.round((perfectMatches.length / fields.length) * 100) : 100}% Cleared
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-3">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Warnings</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-[24px] font-semibold tabular-nums">{warnings.length}</span>
            <span className="text-[11px] text-on-surface-variant">Pending Filing / Tier</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-3">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Critical Discrepancies</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-[24px] font-semibold text-error tabular-nums">{criticals.length}</span>
            <span className="text-[11px] text-error font-medium">
              {criticals[0]?.fieldName ?? 'None'}
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-3 col-span-2 lg:col-span-1">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Registry Source Sync</div>
          <div className="font-semibold text-[13px] text-on-surface mt-1.5">{activeCase.registryLastSyncedAt}</div>
          <div className="font-mono text-[10.5px] text-secondary mt-0.5">
            Response latency {activeCase.registryLatencyMs}ms
          </div>
        </div>
      </div>

      {/* Main Split: Matrix Table + Discrepancy Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[13px] text-on-surface">
                Data Field Verification Matrix
              </span>
              <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    filterMode === 'all' ? 'bg-primary text-white' : 'text-on-surface-variant'
                  }`}
                >
                  All ({fields.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('discrepancies')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    filterMode === 'discrepancies' ? 'bg-primary text-white' : 'text-on-surface-variant'
                  }`}
                >
                  Discrepancies ({criticals.length + warnings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('resolved')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    filterMode === 'resolved' ? 'bg-primary text-white' : 'text-on-surface-variant'
                  }`}
                >
                  Auto-Resolved ({perfectMatches.length})
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCompact((v) => !v)}
              className="text-[11px] font-mono text-on-surface-variant hover:text-on-surface"
            >
              DISPLAY DENSITY: <strong>{compact ? 'Compact (32px)' : 'Standard (36px)'}</strong>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-slate-200 text-[10.5px] font-semibold uppercase text-on-surface-variant">
                  <th className="py-2 px-3">Data Field</th>
                  <th className="py-2 px-3">Declared Value (Onboarding)</th>
                  <th className="py-2 px-3">Official Registry Value</th>
                  <th className="py-2 px-3">Registry Source &amp; ID</th>
                  <th className="py-2 px-3 text-right">Discrepancy Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleFields.map((field) => {
                  const isSelected = focusField?.id === field.id;
                  const isCrit = field.status === 'CRITICAL_MISMATCH';
                  return (
                    <tr
                      key={field.id}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#f0f7ff] border-l-2 border-l-secondary'
                          : isCrit
                            ? 'bg-red-50/30 hover:bg-red-50/50'
                            : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className={`${compact ? 'py-1.5' : 'py-2.5'} px-3 align-top`}>
                        <div className="font-semibold text-[12px] text-on-surface">{field.fieldName}</div>
                        <div className="font-mono text-[10px] text-on-surface-variant">{field.fieldCode}</div>
                      </td>
                      <td className={`${compact ? 'py-1.5' : 'py-2.5'} px-3 align-top text-[12px]`}>
                        <div className="text-on-surface">{field.declaredValue}</div>
                        <div className="text-[10.5px] text-on-surface-variant">{field.declaredSource}</div>
                      </td>
                      <td className={`${compact ? 'py-1.5' : 'py-2.5'} px-3 align-top text-[12px]`}>
                        <div className={isCrit ? 'font-semibold text-error' : 'text-on-surface'}>
                          {field.officialValue}
                        </div>
                        <div className="text-[10.5px] text-on-surface-variant">{field.officialMeta}</div>
                      </td>
                      <td className={`${compact ? 'py-1.5' : 'py-2.5'} px-3 align-top text-[11.5px]`}>
                        <div className="font-medium text-on-surface">{field.registrySource}</div>
                        <div className="font-mono text-[10px] text-on-surface-variant">{field.registryId}</div>
                      </td>
                      <td className={`${compact ? 'py-1.5' : 'py-2.5'} px-3 align-top text-right whitespace-nowrap`}>
                        <RegistryStatusChip status={field.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Inspector: Discrepancy In Focus */}
        <div className="xl:col-span-4 flex flex-col gap-3">
          {focusField && (
            <div className="bg-white border border-slate-200 rounded p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-[14px] text-on-surface">
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      focusField.status === 'CRITICAL_MISMATCH' ? 'text-error' : 'text-secondary'
                    }`}
                  >
                    {focusField.status === 'CRITICAL_MISMATCH' ? 'warning' : 'verified'}
                  </span>
                  <span>
                    {focusField.status === 'CRITICAL_MISMATCH' ? 'Discrepancy In Focus' : 'Field Inspection'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-surface-container-low font-mono text-[10.5px] font-semibold">
                  {focusField.fieldCode}
                </span>
              </div>

              {focusField.status === 'CRITICAL_MISMATCH' ? (
                <div className="p-3 rounded bg-error-container/50 border border-red-200 text-on-error-container">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider">
                    Critical Impact: High Risk
                  </div>
                  <p className="text-[12px] mt-1">
                    {focusField.discrepancySummary ?? focusField.statusNote}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded bg-surface-container-low border border-slate-200">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    {focusField.fieldName}
                  </div>
                  <p className="text-[12px] text-on-surface mt-1">{focusField.statusNote}</p>
                </div>
              )}

              {focusField.linkedDocRef && (
                <div className="p-2.5 rounded bg-surface-container-low border border-slate-200">
                  <div className="text-[10px] font-semibold uppercase text-on-surface-variant mb-1">
                    Evidentiary Ingest Match
                  </div>
                  <div className="font-semibold text-[12px] text-on-surface">{focusField.linkedDocRef}</div>
                  <div className="font-mono text-[11px] text-error mt-0.5">{focusField.linkedDocExtract}</div>
                </div>
              )}

              {focusField.remediationSteps && (
                <div>
                  <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant mb-1.5">
                    Standard Remediation Pathway
                  </div>
                  <ol className="flex flex-col gap-1.5 text-[12px] text-on-surface">
                    {focusField.remediationSteps.map((step, i) => (
                      <li key={step} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-surface-container text-secondary font-mono text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                {focusField.status === 'CRITICAL_MISMATCH' || focusField.status === 'WARNING_PENDING' ? (
                  <button
                    type="button"
                    onClick={() => void onCreateDeficiency(focusField.id)}
                    className="w-full h-8 rounded bg-error text-white font-semibold text-[12px] flex items-center justify-center gap-1.5 hover:bg-red-700"
                  >
                    <span className="material-symbols-outlined text-[16px]">report</span>
                    <span>Create Deficiency Ticket</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void onAcceptField(focusField.id)}
                  className="w-full h-8 rounded border border-slate-200 bg-surface-container-low hover:bg-surface-container font-semibold text-[12px] text-on-surface flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Accept &amp; Lock Field</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('document-viewer')}
                  className="w-full h-8 rounded border border-slate-200 bg-white hover:bg-surface-container-low font-semibold text-[12px] text-on-surface flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Inspect Source Document</span>
                </button>
              </div>
            </div>
          )}

          {/* Connected Registries */}
          <div className="bg-white border border-slate-200 rounded p-3.5 flex flex-col gap-2">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Connected Registries
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span>UK Companies House</span>
              <span className="font-mono text-[11px] text-secondary font-semibold">SYNCED (09:14)</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span>OpenCorporates Global</span>
              <span className="font-mono text-[11px] text-secondary font-semibold">SYNCED (09:14)</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span>Global LEI Foundation</span>
              <span className="font-mono text-[11px] text-secondary font-semibold">MATCHED (09:00)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-7 left-60 right-0 bg-white border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-4 text-[12px]">
          <span className="flex items-center gap-1.5 font-semibold text-on-surface">
            <span className={`w-2 h-2 rounded-full ${criticals.length > 0 ? 'bg-error' : 'bg-emerald-600'}`} />
            {criticals.length > 0
              ? `${criticals.length} Critical Discrepancy blocks Case Completion`
              : 'All Critical Registry Checks Cleared'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={apiUrl(`/api/cases/${encodeURIComponent(activeCase.id)}/registry/export`)}
            className="h-8 px-3 rounded border border-slate-200 bg-surface-container-low hover:bg-surface-container text-[12px] font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>Export Reconciliation Certificate</span>
          </a>
          <button
            type="button"
            onClick={() => void onAcceptAllVerified()}
            className="h-8 px-3 rounded border border-slate-200 bg-white hover:bg-surface-container-low text-[12px] font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">done_all</span>
            <span>Accept All Verified Fields ({perfectMatches.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('deficiency-punch-list')}
            className="h-8 px-3.5 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">forward_to_inbox</span>
            <span>Escalate Discrepancies to RM</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const RegistryStatusChip: React.FC<{ status: RegistryFieldCheck['status'] }> = ({ status }) => {
  switch (status) {
    case 'CRITICAL_MISMATCH':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-error-container text-on-error-container text-[11px] font-semibold">
          ● Critical Mismatch
        </span>
      );
    case 'WARNING_PENDING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
          ● Discrepancy - Pending
        </span>
      );
    case 'INDIRECT_LAYER':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-secondary text-[11px] font-semibold">
          ● Indirect Layer Required
        </span>
      );
    case 'ACCEPTED_BY_ANALYST':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
          ✓ Analyst Accepted
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-low text-secondary text-[11px] font-semibold">
          ● {status === 'ACTIVE_LEI' ? 'Active LEI' : status === 'EXACT_MATCH' ? 'Exact Match' : 'Verified'}
        </span>
      );
  }
};
