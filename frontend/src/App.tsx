import React, { useCallback, useEffect, useState } from 'react';
import type {
  AiGatewayState,
  AuditEvent,
  DeficiencyItem,
  KillSwitchState,
  KycCase,
  NorthgateView,
  OwnershipNode,
  PolicySettings,
  QueueMetrics,
  UboDeterminationStatus,
} from './shared/index';
import { api } from './api';
import { ShellLayout } from './components/ShellLayout';
import { AuditTrailView } from './views/AuditTrailView';
import { DeficiencyPunchListView } from './views/DeficiencyPunchListView';
import { DocumentViewerView } from './views/DocumentViewerView';
import { IntakeQueueView } from './views/IntakeQueueView';
import { OwnershipWorkbenchView } from './views/OwnershipWorkbenchView';
import { ProcessingStateView } from './views/ProcessingStateView';
import { RegistryReconciliationView } from './views/RegistryReconciliationView';
import { SettingsPolicyView } from './views/SettingsPolicyView';

interface ToastState {
  title: string;
  message: string;
  isError?: boolean;
}

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<NorthgateView>('intake-queue');
  const [cases, setCases] = useState<KycCase[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string>('CASE-2024-8841');
  const [activeCaseDetail, setActiveCaseDetail] = useState<KycCase | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [policy, setPolicy] = useState<PolicySettings | null>(null);
  const [killSwitch, setKillSwitch] = useState<KillSwitchState>({ active: false });
  const [aiGateway, setAiGateway] = useState<AiGatewayState>({
    status: 'OPERATIONAL',
    modelId: 'northgate-kyc-proxy-v4.2',
    schemaValidation: 'STRICT',
    uboOverrideGuardrail: 'ENFORCED_READONLY',
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((title: string, message: string, isError = false) => {
    setToast({ title, message, isError });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const loadWorkspace = useCallback(async (targetCaseId?: string) => {
    const [listRes, policyRes, ksRes, aiRes] = await Promise.all([
      api.listCases(),
      api.getPolicy(),
      api.getKillSwitch(),
      api.getAiGateway(),
    ]);
    setCases(listRes.cases);
    setMetrics(listRes.metrics);
    setPolicy(policyRes);
    setKillSwitch(ksRes);
    setAiGateway(aiRes);

    const chosenId =
      targetCaseId && listRes.cases.some((c) => c.id === targetCaseId)
        ? targetCaseId
        : listRes.cases.some((c) => c.id === activeCaseId)
          ? activeCaseId
          : listRes.cases[0]?.id;

    if (chosenId) {
      setActiveCaseId(chosenId);
      const detail = await api.getCase(chosenId);
      setActiveCaseDetail(detail.case);
      setAuditEvents(detail.auditEvents);
    }
  }, [activeCaseId]);

  useEffect(() => {
    void loadWorkspace('CASE-2024-8841')
      .catch((err: unknown) => {
        notify('Backend Connection Error', err instanceof Error ? err.message : String(err), true);
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshActiveCase = useCallback(
    async (caseId = activeCaseId) => {
      const [listRes, detail] = await Promise.all([api.listCases(), api.getCase(caseId)]);
      setCases(listRes.cases);
      setMetrics(listRes.metrics);
      setActiveCaseDetail(detail.case);
      setAuditEvents(detail.auditEvents);
    },
    [activeCaseId]
  );

  const handleSelectCase = async (caseId: string) => {
    setActiveCaseId(caseId);
    try {
      const detail = await api.getCase(caseId);
      setActiveCaseDetail(detail.case);
      setAuditEvents(detail.auditEvents);
    } catch (err) {
      notify('Error Loading Case', err instanceof Error ? err.message : String(err), true);
    }
  };

  if (loading || !activeCaseDetail || !metrics || !policy) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded p-6 flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center font-semibold">
            N
          </div>
          <div>
            <div className="font-semibold text-[14px] text-on-surface">Initializing Project Northgate</div>
            <div className="font-mono text-[11px] text-on-surface-variant">
              Connecting to TypeScript KYC &amp; Audit API...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ShellLayout
        activeView={activeView}
        onNavigate={setActiveView}
        activeCase={activeCaseDetail}
        allCases={cases}
        onSelectCase={(id) => void handleSelectCase(id)}
        metrics={metrics}
        policy={policy}
        killSwitch={killSwitch}
      >
        {activeView === 'intake-queue' && (
          <IntakeQueueView
            cases={cases}
            metrics={metrics}
            activeCase={activeCaseDetail}
            onSelectCase={(id) => void handleSelectCase(id)}
            onNavigate={setActiveView}
            onRefresh={async () => {
              await refreshActiveCase();
            }}
            onUploadBundle={async (fd) => {
              const created = await api.uploadBundle(fd);
              await loadWorkspace(created.id);
              setActiveView('processing-state');
              notify('Bundle Ingested', `${created.entityName} (${created.id}) queued in DAG pipeline.`);
            }}
            notify={notify}
          />
        )}

        {activeView === 'processing-state' && (
          <ProcessingStateView
            activeCase={activeCaseDetail}
            onAdvance={async () => {
              await api.advanceProcessing(activeCaseDetail.id);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Pipeline Advanced', 'Executed next DAG extraction/reconciliation stage.');
            }}
            onAbort={async () => {
              await api.abortProcessing(activeCaseDetail.id);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Pipeline Aborted', 'Intake pipeline halted for manual analyst inspection.');
            }}
            onRetry={async () => {
              await api.retryProcessing(activeCaseDetail.id);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Pipeline Re-dispatched', 'Restarted parallel DAG extraction workers.');
            }}
            onRunAgent={async () => {
              const trace = await api.runAgentWorkflow(activeCaseDetail.id);
              await refreshActiveCase(activeCaseDetail.id);
              notify(
                trace.gateStatus === 'BLOCKED_KILL_SWITCH'
                  ? 'Agent Blocked by Kill Switch'
                  : 'Agentic KYC Workflow Complete',
                `Executed ${trace.steps.length} steps (${trace.runId}).`
              );
            }}
            onApproveAgentGate={async (runId, justification) => {
              await api.approveAgentGate(activeCaseDetail.id, { runId, justification });
              await refreshActiveCase(activeCaseDetail.id);
              notify('Agent Gate Approved', 'Unlocked mcp://notifications and dispatched RM outreach.');
            }}
            onNavigate={setActiveView}
          />
        )}

        {activeView === 'ownership-workbench' && (
          <OwnershipWorkbenchView
            activeCase={activeCaseDetail}
            policy={policy}
            onUpdateNode={async (nodeId, payload: { determinationStatus: UboDeterminationStatus; analystNotes: string }) => {
              await api.updateOwnershipNode(activeCaseDetail.id, nodeId, payload);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Determination Saved', 'Analyst verification logged to SHA-256 audit chain.');
            }}
            onAddNode={async (payload: {
              parentId: string;
              name: string;
              kind: OwnershipNode['kind'];
              legalForm: string;
              jurisdiction: string;
              directPct: number;
              analystNotes?: string;
            }) => {
              await api.addOwnershipNode(activeCaseDetail.id, payload);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Node Added', 'Recalculated cumulative effective UBO percentages.');
            }}
            onCommitStructure={async () => {
              await api.commitOwnership(activeCaseDetail.id);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Structure Committed', 'Cap table hierarchy locked under FATF / 5AMLD rules.');
            }}
            onNavigate={setActiveView}
          />
        )}

        {activeView === 'registry-reconciliation' && (
          <RegistryReconciliationView
            activeCase={activeCaseDetail}
            onRefreshRegistry={async () => {
              await api.refreshRegistry(activeCaseDetail.id);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Registries Synced', 'Re-queried Companies House, GLEIF, and OpenCorporates.');
            }}
            onAcceptField={async (fieldId) => {
              await api.acceptRegistryField(activeCaseDetail.id, fieldId);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Field Accepted', 'Registry verification locked to audit trail.');
            }}
            onAcceptAllVerified={async () => {
              await api.acceptVerifiedRegistryFields(activeCaseDetail.id);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Batch Accepted', 'All exact and verified registry fields accepted.');
            }}
            onCreateDeficiency={async (fieldId) => {
              await api.createDeficiencyFromField(activeCaseDetail.id, fieldId);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Deficiency Ticket Created', 'Added discrepancy to Deficiency Punch List.');
            }}
            onNavigate={setActiveView}
          />
        )}

        {activeView === 'document-viewer' && (
          <DocumentViewerView
            activeCase={activeCaseDetail}
            onSaveAnnotation={async (docId, annotation) => {
              await api.saveDocumentAnnotation(activeCaseDetail.id, docId, annotation);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Annotation Saved', 'Case annotation recorded in audit trail.');
            }}
            onFlagDeficiency={async (docId, bboxId) => {
              await api.flagDocumentDeficiency(activeCaseDetail.id, docId, bboxId);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Flagged as Deficiency', 'Created evidentiary deficiency ticket from OCR bounding region.');
            }}
            onNavigate={setActiveView}
            notify={notify}
          />
        )}

        {activeView === 'deficiency-punch-list' && (
          <DeficiencyPunchListView
            activeCase={activeCaseDetail}
            onRefreshRegistry={async () => {
              await api.refreshRegistry(activeCaseDetail.id);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Companies House Synced', 'Refreshed statutory filings for punch list.');
            }}
            onAddDeficiency={async (payload: Partial<DeficiencyItem>) => {
              await api.addDeficiency(activeCaseDetail.id, payload);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Deficiency Added', 'New compliance item appended to punch list.');
            }}
            onUpdateDeficiency={async (itemId, patch) => {
              await api.updateDeficiency(activeCaseDetail.id, itemId, patch);
              await refreshActiveCase(activeCaseDetail.id);
              if (patch.status === 'REMEDIATED') {
                notify('Item Remediated', 'Deficiency marked as remediated.');
              }
            }}
            onSendOutreach={async (payload) => {
              await api.sendDeficiencyOutreach(activeCaseDetail.id, payload);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Outreach Dispatched', 'Remediation notice pushed via Secure RM Portal.');
            }}
            notify={notify}
          />
        )}

        {activeView === 'audit-trail' && (
          <AuditTrailView
            activeCase={activeCaseDetail}
            initialEvents={auditEvents}
            onSignOff={async (action) => {
              await api.signOffAudit(activeCaseDetail.id, { action });
              await refreshActiveCase(activeCaseDetail.id);
              notify(
                action === 'APPROVE_LOCK' ? 'Audit Trail Signed & Locked' : 'Override Rejected',
                action === 'APPROVE_LOCK'
                  ? 'Executive cryptographic attestation recorded.'
                  : 'Case returned to Deficiencies Pending.'
              );
            }}
            notify={notify}
          />
        )}

        {activeView === 'settings-policy' && (
          <SettingsPolicyView
            policy={policy}
            killSwitch={killSwitch}
            aiGateway={aiGateway}
            activeCase={activeCaseDetail}
            onUpdatePolicy={async (patch) => {
              const nextPolicy = await api.updatePolicy(patch);
              setPolicy(nextPolicy);
              await refreshActiveCase(activeCaseDetail.id);
              notify('Policy Updated', 'Compliance thresholds saved and UBO trees recalculated.');
            }}
            onToggleKillSwitch={async (active, reason) => {
              const nextKs = await api.setKillSwitch(active, reason);
              setKillSwitch(nextKs);
              await refreshActiveCase(activeCaseDetail.id);
              notify(
                nextKs.active ? 'Emergency Kill Switch Engaged' : 'Kill Switch Disengaged',
                nextKs.active
                  ? 'All worker execution and outbound communications frozen.'
                  : 'Operational pipeline resumed.',
                nextKs.active
              );
            }}
            onToggleAiOutage={async (outage) => {
              const nextAi = await api.toggleAiOutage(outage);
              setAiGateway(nextAi);
              notify(
                outage ? 'AI Gateway Outage Simulated' : 'AI Gateway Restored',
                outage ? 'Circuit breaker open; deterministic fallback active.' : 'Proxy operational.'
              );
            }}
            onResetDemo={async () => {
              await api.resetDemo();
              await loadWorkspace('CASE-2024-8841');
              setActiveView('intake-queue');
              notify('Demo Reset', 'Restored synthetic institutional dataset.');
            }}
            notify={notify}
          />
        )}
      </ShellLayout>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-16 right-4 z-50 max-w-sm bg-white border rounded shadow-lg px-3.5 py-2.5 flex items-start gap-2.5 ${
            toast.isError ? 'border-red-300' : 'border-slate-300'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] mt-0.5 ${
              toast.isError ? 'text-error' : 'text-secondary'
            }`}
          >
            {toast.isError ? 'error' : 'check_circle'}
          </span>
          <div>
            <div className="font-semibold text-[12.5px] text-on-surface">{toast.title}</div>
            <div className="text-[11.5px] text-on-surface-variant">{toast.message}</div>
          </div>
        </div>
      )}
    </>
  );
};
