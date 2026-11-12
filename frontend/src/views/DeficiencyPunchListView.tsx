import React, { useEffect, useState } from 'react';
import { apiUrl } from '../api';
import type { DeficiencyItem, DeficiencySeverity, KycCase } from '../shared/index';

interface DeficiencyPunchListViewProps {
  activeCase: KycCase;
  onRefreshRegistry: () => Promise<void>;
  onAddDeficiency: (payload: Partial<DeficiencyItem>) => Promise<void>;
  onUpdateDeficiency: (itemId: string, patch: Partial<DeficiencyItem>) => Promise<void>;
  onSendOutreach: (payload: {
    subject?: string;
    body?: string;
    assignedRmEmail?: string;
    escalationCcEmail?: string;
  }) => Promise<void>;
  notify: (title: string, message: string) => void;
}

export const DeficiencyPunchListView: React.FC<DeficiencyPunchListViewProps> = ({
  activeCase,
  onRefreshRegistry,
  onAddDeficiency,
  onUpdateDeficiency,
  onSendOutreach,
  notify,
}) => {
  const [rmEmail, setRmEmail] = useState(activeCase.assignedRmEmail);
  const [ccEmail, setCcEmail] = useState(activeCase.escalationCcEmail);
  const [draftSubject, setDraftSubject] = useState(activeCase.outreachDraft.subject);
  const [draftBody, setDraftBody] = useState(activeCase.outreachDraft.body);
  const [sending, setSending] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState<DeficiencySeverity>('CRITICAL_BLOCKER');
  const [newTarget, setNewTarget] = useState(activeCase.entityName);
  const [newRegRef, setNewRegRef] = useState('FCA MLR 2017 / FATF Rec 10');

  useEffect(() => {
    setRmEmail(activeCase.assignedRmEmail);
    setCcEmail(activeCase.escalationCcEmail);
    setDraftSubject(activeCase.outreachDraft.subject);
    setDraftBody(activeCase.outreachDraft.body);
  }, [
    activeCase.id,
    activeCase.assignedRmEmail,
    activeCase.escalationCcEmail,
    activeCase.outreachDraft.subject,
    activeCase.outreachDraft.body,
  ]);

  const items = activeCase.deficiencies;
  const openItems = items.filter((d) => d.status !== 'REMEDIATED');
  const criticalCount = openItems.filter((d) => d.severity === 'CRITICAL_BLOCKER').length;
  const standardCount = openItems.filter((d) => d.severity === 'STANDARD_WARNING').length;
  const selectedCount = openItems.filter((d) => d.selectedForOutreach).length;
  const allSelected = openItems.length > 0 && selectedCount === openItems.length;

  const toggleAll = async () => {
    const nextVal = !allSelected;
    for (const item of openItems) {
      if (item.selectedForOutreach !== nextVal) {
        await onUpdateDeficiency(item.id, { selectedForOutreach: nextVal });
      }
    }
  };

  const handleSendOutreach = async () => {
    setSending(true);
    try {
      await onSendOutreach({
        subject: draftSubject,
        body: draftBody,
        assignedRmEmail: rmEmail,
        escalationCcEmail: ccEmail,
      });
    } finally {
      setSending(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onAddDeficiency({
      title: newTitle.trim(),
      description: newDesc.trim() || 'Added manually by KYC Senior Analyst.',
      severity: newSeverity,
      targetEntityOrPerson: newTarget.trim() || activeCase.entityName,
      regulatoryRef: newRegRef.trim(),
    });
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold text-on-surface tracking-tight">
              Deficiency Punch List &amp; Remediation Generator
            </h1>
            <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-mono text-[10.5px] font-semibold uppercase">
              Stage 3 Triage
            </span>
          </div>
          <p className="text-[12px] text-on-surface-variant mt-0.5">
            Actionable audit checklist of missing documentation and registry disparities for Relationship Manager resolution.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void onRefreshRegistry()}
            className="h-8 px-3 rounded bg-white border border-slate-200 hover:bg-surface-container-low text-[12px] font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Sync Companies House</span>
          </button>
          <a
            href={apiUrl(`/api/cases/${encodeURIComponent(activeCase.id)}/audit/export?format=json`)}
            className="h-8 px-3 rounded bg-white border border-slate-200 hover:bg-surface-container-low text-[12px] font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Audit Package</span>
          </a>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="h-8 px-3 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add_task</span>
            <span>Add Custom Item</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded p-3">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">
            Identified Deficiencies
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-[26px] font-semibold tabular-nums">{openItems.length}</span>
            <span className="text-[11.5px] text-on-surface-variant">open in case ledger</span>
          </div>
          <div className="mt-2 h-1 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-primary w-3/4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Critical Blockers</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-[26px] font-semibold text-error tabular-nums">{criticalCount}</span>
            <span className="text-[11.5px] text-error font-medium">Halts account activation</span>
          </div>
          <div className="mt-2 h-1 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-error w-1/2" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">Standard Missing</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-[26px] font-semibold tabular-nums">{standardCount}</span>
            <span className="text-[11.5px] text-on-surface-variant">Remediation within 5 days</span>
          </div>
          <div className="mt-2 h-1 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-secondary w-1/2" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3">
          <div className="text-[10.5px] font-semibold uppercase text-on-surface-variant">
            Current Pipeline Gate
          </div>
          <div className="mt-2">
            {openItems.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-error-container text-on-error-container text-[11px] font-semibold uppercase">
                <span className="w-2 h-2 rounded-full bg-error" />
                Blocked Pending Remediation
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Clear for Activation
              </span>
            )}
          </div>
          <div className="mt-2 text-right font-mono text-[10.5px] text-on-surface-variant">
            SLA Deadline: {activeCase.slaDeadlineLabel}
          </div>
        </div>
      </div>

      {/* Evidentiary Discrepancy Ledger Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="px-3.5 py-2.5 bg-surface-container-low border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[13.5px] text-on-surface">
              Evidentiary Discrepancy Ledger
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-semibold">
              {selectedCount} / {openItems.length} Selected for Outreach
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleAll()}
              className="h-7 px-2.5 rounded bg-white border border-slate-200 text-[11px] font-semibold hover:bg-surface-container"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
              Auto-audited via OCR &amp; LEI Index
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-slate-200 text-[10.5px] font-semibold uppercase text-on-surface-variant">
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={allSelected} onChange={() => void toggleAll()} />
                </th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Deficiency Item</th>
                <th className="px-3 py-2">Target Entity / Person</th>
                <th className="px-3 py-2">Regulatory Reference</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Age</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[12px]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-on-surface-variant">
                    Zero open deficiencies for {activeCase.entityName}.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isRemediated = item.status === 'REMEDIATED';
                  return (
                    <tr key={item.id} className={isRemediated ? 'bg-slate-50/70 opacity-70' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="checkbox"
                          disabled={isRemediated}
                          checked={item.selectedForOutreach}
                          onChange={(e) =>
                            void onUpdateDeficiency(item.id, { selectedForOutreach: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        {item.severity === 'CRITICAL_BLOCKER' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-error-container text-on-error-container text-[10.5px] font-semibold uppercase">
                            ● Critical Blocker
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-secondary text-[10.5px] font-semibold uppercase">
                            ● Standard Warning
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-semibold text-on-surface">{item.title}</div>
                        <div className="text-[11px] text-on-surface-variant">{item.description}</div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-medium text-on-surface">{item.targetEntityOrPerson}</div>
                        <div className="text-[10.5px] text-on-surface-variant">{item.targetSubLabel}</div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-mono text-[11px] font-semibold text-on-surface">{item.regulatoryRef}</div>
                        <div className="text-[11px] text-error">{item.regulatoryNote}</div>
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isRemediated
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                              : item.status === 'OUTREACH_DISPATCHED'
                                ? 'bg-surface-container text-secondary'
                                : item.status === 'EXPIRED_DOCUMENT'
                                  ? 'bg-error-container text-on-error-container'
                                  : 'bg-surface-container-high text-on-surface'
                          }`}
                        >
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top text-right font-mono font-semibold whitespace-nowrap">
                        {item.ageDays} Days
                      </td>
                      <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateDeficiency(item.id, {
                              status: isRemediated ? 'PENDING_RM_SUBMISSION' : 'REMEDIATED',
                            })
                          }
                          className="h-7 px-2.5 rounded bg-surface-container-low hover:bg-primary hover:text-white text-[11px] font-semibold transition-colors"
                        >
                          {isRemediated ? 'Reopen' : 'Mark Remediated'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Split: Draft Institutional Outreach + Target Profile & SLA Rules */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">mail</span>
              </div>
              <div>
                <div className="font-semibold text-[14px] text-on-surface">Draft Institutional Outreach</div>
                <div className="text-[11.5px] text-on-surface-variant">
                  Recipient: {activeCase.assignedRmName} (Senior Relationship Manager)
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded bg-surface-container-low font-mono text-[11px] text-on-surface">
                Channel: Secure RM Portal (Encrypted)
              </span>
              {activeCase.outreachDraft.lastSentAt && (
                <div className="font-mono text-[10.5px] text-emerald-700 mt-0.5">
                  Last Dispatched: {activeCase.outreachDraft.lastSentAt.slice(0, 19).replace('T', ' ')} UTC (Count:{' '}
                  {activeCase.outreachDraft.sentCount})
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-semibold uppercase text-on-surface-variant mb-1">
                Assigned RM Contact
              </label>
              <input
                type="email"
                value={rmEmail}
                onChange={(e) => setRmEmail(e.target.value)}
                className="w-full h-8 px-2.5 bg-surface-container-low border border-slate-200 rounded font-mono text-[12px]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold uppercase text-on-surface-variant mb-1">
                Escalation Group CC
              </label>
              <input
                type="email"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                className="w-full h-8 px-2.5 bg-surface-container-low border border-slate-200 rounded font-mono text-[12px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-semibold uppercase text-on-surface-variant mb-1">
              Subject
            </label>
            <input
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="w-full h-8 px-2.5 bg-surface-container-low border border-slate-200 rounded text-[12.5px] font-semibold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-semibold uppercase text-on-surface-variant">
                Remediation Notice Message Body
              </label>
              <span className="font-mono text-[10.5px] text-on-surface-variant">
                Generated from {selectedCount} active checklist item(s)
              </span>
            </div>
            <textarea
              rows={9}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="w-full p-3 bg-surface-container-low border border-slate-200 rounded font-mono text-[12px] leading-relaxed focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(`Subject: ${draftSubject}\n\n${draftBody}`);
                  notify('Copied Notice', 'Outreach subject & body copied to clipboard.');
                }}
                className="h-8 px-3 rounded border border-slate-200 bg-white hover:bg-surface-container-low text-[12px] font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">content_copy</span>
                <span>Copy to Clipboard</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftSubject(activeCase.outreachDraft.subject);
                  setDraftBody(activeCase.outreachDraft.body);
                  notify('Template Restored', 'Reset outreach draft to generated punch-list template.');
                }}
                className="h-8 px-3 rounded border border-slate-200 bg-white hover:bg-surface-container-low text-[12px] font-semibold"
              >
                Reset Template
              </button>
            </div>
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSendOutreach()}
              className="h-8 px-4 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>{sending ? 'Dispatching...' : 'Send via Secure Portal'}</span>
            </button>
          </div>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-3">
          <div className="bg-white border border-slate-200 rounded p-4 flex flex-col gap-2.5">
            <div className="font-semibold text-[13.5px] text-on-surface">Target Entity Profile</div>
            <div className="text-[12px] flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Legal Entity Name</span>
                <strong className="text-on-surface">{activeCase.entityName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">{activeCase.identifierLabel}</span>
                <span className="font-mono text-on-surface">{activeCase.identifierValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Jurisdiction</span>
                <span className="text-on-surface">{activeCase.jurisdiction}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
              <div className="p-2 rounded bg-surface-container-low">
                <div className="text-[10px] uppercase text-on-surface-variant">Verified</div>
                <div className="font-semibold text-secondary">{activeCase.fileCount} Docs</div>
              </div>
              <div className="p-2 rounded bg-error-container/40">
                <div className="text-[10px] uppercase text-on-error-container">Blockers</div>
                <div className="font-semibold text-error">{criticalCount} Docs</div>
              </div>
              <div className="p-2 rounded bg-surface-container-low">
                <div className="text-[10px] uppercase text-on-surface-variant">Standard</div>
                <div className="font-semibold text-on-surface">{standardCount} Docs</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-4 flex flex-col gap-2.5 text-[12px]">
            <div className="font-semibold text-[13.5px] text-on-surface">Institutional RM SLA Rules</div>
            <div>
              <div className="font-semibold text-on-surface">Tier 1 Turnaround Rule</div>
              <p className="text-[11.5px] text-on-surface-variant">
                RM has 5 business days to upload verified replacements before case moves to formal freeze.
              </p>
            </div>
            <div>
              <div className="font-semibold text-on-surface">Chain of Custody</div>
              <p className="text-[11.5px] text-on-surface-variant">
                Direct client email transmission is strictly prohibited. Outgoing items must be pushed via Secure RM Client Portal.
              </p>
            </div>
            <div>
              <div className="font-semibold text-on-surface">Notary Requirement</div>
              <p className="text-[11.5px] text-on-surface-variant">
                Cayman Incumbency and UK Board Registry extracts must bear wet or validated eIDAS seals.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Custom Deficiency Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-semibold text-[15px] text-on-surface">Add Custom Deficiency Item</h3>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                Deficiency Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Certified Proof of Residential Address (<90d)"
                className="w-full h-8 px-2.5 border border-slate-300 rounded text-[12px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-[12px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Severity
                </label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as DeficiencySeverity)}
                  className="w-full h-8 px-2 border border-slate-300 rounded text-[12px] bg-white"
                >
                  <option value="CRITICAL_BLOCKER">Critical Blocker</option>
                  <option value="STANDARD_WARNING">Standard Warning</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                  Target Entity / Person
                </label>
                <input
                  type="text"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded text-[12px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
                Regulatory Reference
              </label>
              <input
                type="text"
                value={newRegRef}
                onChange={(e) => setNewRegRef(e.target.value)}
                className="w-full h-8 px-2.5 border border-slate-300 rounded font-mono text-[12px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-8 px-3 border border-slate-200 rounded text-[12px] font-semibold"
              >
                Cancel
              </button>
              <button type="submit" className="h-8 px-3.5 bg-primary text-white rounded text-[12px] font-semibold">
                Add to Ledger
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
