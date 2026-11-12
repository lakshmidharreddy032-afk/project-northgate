import React, { useRef, useState } from 'react';
import type { CaseStatus, KycCase, NorthgateView, QueueMetrics } from '../shared/index';
import { apiUrl, formatDurationSec } from '../api';

interface IntakeQueueViewProps {
  cases: KycCase[];
  metrics: QueueMetrics;
  activeCase: KycCase;
  onSelectCase: (caseId: string) => void;
  onNavigate: (view: NorthgateView) => void;
  onUploadBundle: (formData: FormData) => Promise<void>;
  onRefresh: () => Promise<void>;
  notify: (title: string, message: string) => void;
}

export const IntakeQueueView: React.FC<IntakeQueueViewProps> = ({
  cases,
  metrics,
  activeCase,
  onSelectCase,
  onNavigate,
  onUploadBundle,
  onRefresh,
  notify,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('all');
  const [tableQuery, setTableQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [entityName, setEntityName] = useState('');
  const [jurisdiction, setJurisdiction] = useState('United Kingdom');
  const [legalForm, setLegalForm] = useState('Private Ltd');
  const [identifierValue, setIdentifierValue] = useState('');
  const [primaryUboName, setPrimaryUboName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const jurisdictions = Array.from(new Set(cases.map((c) => c.jurisdiction)));

  const filteredCases = cases.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (jurisdictionFilter !== 'all' && c.jurisdiction !== jurisdictionFilter) return false;
    if (tableQuery.trim()) {
      const q = tableQuery.trim().toLowerCase();
      return (
        c.id.toLowerCase().includes(q) ||
        c.entityName.toLowerCase().includes(q) ||
        c.jurisdiction.toLowerCase().includes(q) ||
        c.identifierValue.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleFilesChosen = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFiles(Array.from(files));
    setShowUploadModal(true);
  };

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('entityName', entityName.trim() || 'Meridian Eurofreight S.A.');
      fd.append('jurisdiction', jurisdiction);
      fd.append('legalForm', legalForm);
      fd.append('identifierValue', identifierValue.trim() || 'LU-RCS-B249102');
      if (primaryUboName.trim()) fd.append('primaryUboName', primaryUboName.trim());
      for (const file of selectedFiles) {
        fd.append('files', file);
      }
      await onUploadBundle(fd);
      setShowUploadModal(false);
      setSelectedFiles([]);
      setEntityName('');
      setIdentifierValue('');
      setPrimaryUboName('');
    } finally {
      setUploading(false);
    }
  };

  const triggerSampleBundle = async () => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('entityName', 'Northsea Marine Logistics GmbH');
      fd.append('jurisdiction', 'Germany');
      fd.append('legalForm', 'GmbH');
      fd.append('identifierValue', 'HRB-194022');
      fd.append('primaryUboName', 'Matthias Weber');
      await onUploadBundle(fd);
    } finally {
      setUploading(false);
    }
  };

  const statusTabs: Array<{ key: 'all' | CaseStatus; label: string; dot?: string; danger?: boolean }> = [
    { key: 'all', label: 'All Cases' },
    { key: 'Ready for Review', label: 'Ready for Review', dot: 'bg-secondary' },
    { key: 'Processing', label: 'Processing', dot: 'bg-secondary-container animate-pulse' },
    { key: 'Deficiencies Pending', label: 'Deficiencies Pending', dot: 'bg-error', danger: true },
    { key: 'Verified / Cleared', label: 'Verified / Cleared', dot: 'bg-emerald-600' },
  ];

  const previewTier1 = activeCase.ownershipNodes.find((n) => n.tier === 0);
  const previewTier2 = activeCase.ownershipNodes.find((n) => n.tier === 1);
  const previewTier3 = activeCase.ownershipNodes.find((n) => n.tier === 2) ?? activeCase.ownershipNodes.find((n) => n.isQualifiedUbo);

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Top Action & Filter Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-surface-container-lowest border border-slate-200 p-3.5 rounded">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase text-secondary font-semibold tracking-wider">
              KYC Operations Stream
            </span>
            <span className="inline-block w-1 h-1 rounded-full bg-outline-variant" />
            <span className="font-mono text-[11px] text-on-surface-variant">FedRAMP Enclave East-1</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[20px] font-semibold text-on-surface tracking-tight">
              Intake &amp; Triage Queue
            </h1>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono text-[11px] font-semibold">
              {metrics.activeQueueCount} Active Intake Units
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 h-8 px-2.5 bg-surface-container-low rounded text-on-surface text-[12px]">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_today</span>
            <span className="font-mono text-[11px] font-medium">Today: 24 Oct 2024 (UTC)</span>
          </div>

          <a
            href={apiUrl('/api/cases/export-ledger')}
            className="h-8 px-3 bg-surface-container-low border border-slate-200 rounded text-on-surface font-semibold text-[12px] flex items-center gap-1.5 hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export Ledger</span>
          </a>

          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="h-8 px-3 bg-primary-container text-on-primary rounded font-semibold text-[12px] flex items-center gap-1.5 hover:bg-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span>Upload Bundle</span>
          </button>
        </div>
      </div>

      {/* Triage Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container-lowest border border-slate-200 px-3 py-2 rounded">
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.key;
            const count = metrics.statusCounts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                {tab.dot && <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />}
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-mono text-[10.5px] ${
                    active
                      ? 'bg-white/20 text-white'
                      : tab.danger
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-surface-container-high text-on-surface'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded text-[12px]">
            <span className="material-symbols-outlined text-[15px] text-on-surface-variant">filter_list</span>
            <select
              value={jurisdictionFilter}
              onChange={(e) => setJurisdictionFilter(e.target.value)}
              className="bg-transparent font-semibold text-[11px] text-on-surface focus:outline-none"
            >
              <option value="all">All Jurisdictions</option>
              {jurisdictions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              void onRefresh().then(() => notify('Queue Synced', 'Intake queue refreshed from backend store.'));
            }}
            className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            title="Refresh Table"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
          </button>
        </div>
      </div>

      {/* Intake Drop Zone Card */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFilesChosen(e.dataTransfer.files);
        }}
        className={`bg-surface-container-lowest border rounded p-3.5 transition-all ${
          dragOver ? 'border-secondary ring-2 ring-secondary/20 bg-surface-container-low' : 'border-slate-200'
        }`}
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded bg-surface-container-low flex items-center justify-center text-secondary shrink-0">
              <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[14px] text-on-surface">
                  Deposit Onboarding Package Bundle
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-primary-fixed-variant text-[11px] font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-secondary">bolt</span>
                  Automated entity extraction &amp; cross-check under 90s
                </span>
              </div>
              <p className="text-[12px] text-on-surface-variant">
                Drag &amp; drop corporate formation packets, share registries, register of directors, and UBO proof of identity (PDF, ZIP, TIFF max 500MB).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={uploading}
              onClick={() => void triggerSampleBundle()}
              className="h-8 px-3 bg-surface-container-low border border-slate-200 rounded text-on-surface text-[12px] font-semibold hover:bg-surface-container flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">description</span>
              <span>{uploading ? 'Ingesting...' : 'Sample Bundle (Fast Ingest)'}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesChosen(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 bg-primary text-on-primary rounded text-[12px] font-semibold hover:bg-primary-container flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              <span>Browse Files</span>
            </button>
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
            <span className="font-semibold text-on-surface">OCR PIPELINE:</span>
            <span>Leptos OCR v2.8 • LEI GLEIF Auto-resolver Active • UK Companies House API Connected</span>
          </div>
          <span className="font-mono text-[10.5px]">Supported schemas: XBRL, PDF/A-3, CSV Ledger</span>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest border border-slate-200 rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
            <span>Active Queue</span>
            <span className="material-symbols-outlined text-[16px]">layers</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-[26px] font-semibold text-on-surface tabular-nums">{metrics.activeQueueCount}</span>
            <span className="text-[11.5px] font-semibold text-secondary">+{metrics.deltaFromLastShift} from last shift</span>
          </div>
          <div className="mt-2 h-1 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-primary w-3/4" />
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-slate-200 rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
            <span>Avg Intake Cycle Time</span>
            <span className="material-symbols-outlined text-[16px]">schedule</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-[26px] font-semibold text-on-surface tabular-nums">
              {formatDurationSec(metrics.avgIntakeCycleSec)}
            </span>
            <span className="text-[11.5px] font-semibold text-secondary">-24s vs SLA limit</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-on-surface-variant">
            <div className="h-1 flex-1 bg-surface-container-low rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-2/3" />
            </div>
            <span className="font-mono">Target &lt; {formatDurationSec(metrics.targetCycleSec)}</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-slate-200 rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
            <span>Discrepancy Rate</span>
            <span className="material-symbols-outlined text-[16px] text-error">error_outline</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-[26px] font-semibold text-on-surface tabular-nums">
              {metrics.discrepancyRatePct}%
            </span>
            <span className="text-[11.5px] font-semibold text-error">{metrics.flaggedUboPct}% flagged UBO</span>
          </div>
          <div className="mt-2 h-1 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-error w-1/4" />
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-slate-200 rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
            <span>SLA Compliance</span>
            <span className="material-symbols-outlined text-[16px]">verified</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-[26px] font-semibold text-on-surface tabular-nums">
              {metrics.slaCompliancePct}%
            </span>
            <span className="text-[11.5px] text-on-surface-variant">
              {metrics.slaPassedCount} of {metrics.slaTotalCount} cases
            </span>
          </div>
          <div className="mt-2 h-1 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-secondary w-11/12" />
          </div>
        </div>
      </div>

      {/* Intake Case Table */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[15px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
              placeholder="Filter by legal entity name, jurisdiction, or case ID..."
              className="w-full h-8 pl-8 pr-3 bg-surface-container-low rounded text-[12px] text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>
          <span className="text-[11.5px] text-on-surface-variant font-mono">
            Displaying {filteredCases.length} of {cases.length} cases
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-slate-200 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
                <th className="py-2.5 px-3.5">Case ID</th>
                <th className="py-2.5 px-3">Client Legal Name</th>
                <th className="py-2.5 px-3">Jurisdiction &amp; Type</th>
                <th className="py-2.5 px-3">Documents Received</th>
                <th className="py-2.5 px-3">Processing Status</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.map((c) => {
                const isSelected = c.id === activeCase.id;
                const openDefCount = c.deficiencies.filter((d) => d.status !== 'REMEDIATED').length;
                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#f0f7ff] border-l-2 border-l-secondary' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3.5 font-mono text-[12px] font-semibold text-secondary whitespace-nowrap">
                      {c.id}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[13px] text-on-surface flex items-center gap-1.5">
                        <span>{c.entityName}</span>
                        {c.ownershipCommitted && (
                          <span className="material-symbols-outlined text-[15px] text-secondary" title="Ownership Committed">
                            verified
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10.5px] text-on-surface-variant">
                        {c.identifierLabel}: {c.identifierValue}
                        {c.secondaryRef ? ` • ${c.secondaryRef}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-on-surface whitespace-nowrap">
                      {c.jurisdiction}{' '}
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-low font-mono text-[10.5px] text-on-surface-variant">
                        {c.legalForm}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-low font-mono text-[10.5px] font-semibold text-on-surface whitespace-nowrap">
                          {c.fileCount} Files
                        </span>
                        <span className="text-[11.5px] text-on-surface-variant truncate max-w-[200px]">
                          {c.documentsSummary}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <CaseStatusBadge status={c.status} openDefCount={openDefCount} />
                    </td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCase(c.id);
                          onNavigate(c.status === 'Processing' ? 'processing-state' : 'ownership-workbench');
                        }}
                        className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-primary hover:text-white text-[11px] font-semibold text-on-surface transition-colors"
                      >
                        {c.status === 'Processing' ? 'View Pipeline' : 'Open Workbench'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extracted Entity Topology Preview */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">hub</span>
            <span className="font-semibold text-[13px] text-on-surface">
              Extracted Entity Topology Preview: {activeCase.id}
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-mono text-[10.5px] font-semibold">
              Auto-Structured 94% Conf.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ownership-workbench')}
            className="text-[12px] font-semibold text-secondary hover:underline flex items-center gap-1"
          >
            <span>Launch Full Interactive Workbench</span>
            <span className="material-symbols-outlined text-[15px]">open_in_new</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded bg-surface-container-low border border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              <span>Tier 1 Target</span>
              <span className="font-mono text-on-surface">100.0% Direct</span>
            </div>
            <div className="font-semibold text-[13px] text-on-surface mt-1">
              {previewTier1?.name ?? activeCase.entityName}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">
              {previewTier1?.registrationOrCitizenship ?? activeCase.jurisdiction}
            </div>
          </div>

          <div className="p-3 rounded bg-surface-container-low border border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              <span>Tier 2 Holding / Direct</span>
              <span className="font-mono text-on-surface">
                {previewTier2 ? `${previewTier2.directPct.toFixed(1)}% Equity` : 'N/A'}
              </span>
            </div>
            <div className="font-semibold text-[13px] text-on-surface mt-1">
              {previewTier2?.name ?? 'Direct Ownership'}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">
              {previewTier2?.registrationOrCitizenship ?? 'No intermediate layers'}
            </div>
          </div>

          <div className="p-3 rounded bg-surface-container-low border border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              <span>Tier 3 Ultimate Beneficial Owner</span>
              <span className="font-mono text-secondary font-semibold">
                {previewTier3 ? `${previewTier3.effectivePct.toFixed(1)}% Effective` : 'Pending'}
              </span>
            </div>
            <div className="font-semibold text-[13px] text-on-surface mt-1">
              {previewTier3?.name ?? 'Pending Identification'}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">
              {previewTier3?.screeningResult ?? 'Sanctions screening pending'}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Bundle Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={submitUpload}
            className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="font-semibold text-[16px] text-on-surface">
                  Deposit Onboarding Package Bundle
                </h2>
                <p className="text-[11.5px] text-on-surface-variant">
                  Files are hashed (SHA-256) and dispatched to the 4-worker DAG extraction pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Client Legal Entity Name
                </label>
                <input
                  type="text"
                  required
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="e.g. Meridian Eurofreight S.A."
                  className="w-full h-8 px-2.5 border border-slate-300 rounded text-[12.5px] focus:outline-none focus:border-secondary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Jurisdiction
                </label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full h-8 px-2 border border-slate-300 rounded text-[12.5px] bg-white focus:outline-none focus:border-secondary"
                >
                  <option>United Kingdom</option>
                  <option>Luxembourg</option>
                  <option>Delaware, US</option>
                  <option>Germany</option>
                  <option>Switzerland</option>
                  <option>Netherlands</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Legal Form
                </label>
                <input
                  type="text"
                  value={legalForm}
                  onChange={(e) => setLegalForm(e.target.value)}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded text-[12.5px] focus:outline-none focus:border-secondary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Registration / LEI
                </label>
                <input
                  type="text"
                  value={identifierValue}
                  onChange={(e) => setIdentifierValue(e.target.value)}
                  placeholder="e.g. 213800..."
                  className="w-full h-8 px-2.5 border border-slate-300 rounded font-mono text-[12px] focus:outline-none focus:border-secondary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Primary UBO Name
                </label>
                <input
                  type="text"
                  value={primaryUboName}
                  onChange={(e) => setPrimaryUboName(e.target.value)}
                  placeholder="e.g. Claire Beaumont"
                  className="w-full h-8 px-2.5 border border-slate-300 rounded text-[12.5px] focus:outline-none focus:border-secondary"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                Attached Documents ({selectedFiles.length})
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                className="w-full text-[12px] text-on-surface-variant"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="h-8 px-3 border border-slate-200 rounded text-[12px] font-semibold text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="h-8 px-4 bg-primary text-white rounded text-[12px] font-semibold hover:bg-primary-container"
              >
                {uploading ? 'Ingesting Bundle...' : 'Ingest & Launch DAG'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const CaseStatusBadge: React.FC<{ status: CaseStatus; openDefCount: number }> = ({
  status,
  openDefCount,
}) => {
  if (status === 'Verified / Cleared') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
        <span className="material-symbols-outlined text-[13px]">check_circle</span>
        Verified / Cleared
      </span>
    );
  }
  if (status === 'Deficiencies Pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-error-container border border-red-200 text-on-error-container text-[11px] font-semibold">
        <span className="material-symbols-outlined text-[13px]">warning</span>
        Deficiencies ({openDefCount} Open)
      </span>
    );
  }
  if (status === 'Processing') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-secondary text-[11px] font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
        Processing (DAG Active)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-low border border-slate-200 text-secondary text-[11px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
      {status}
    </span>
  );
};
