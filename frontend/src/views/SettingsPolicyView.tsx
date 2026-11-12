import React, { useEffect, useState } from 'react';
import type {
  AiGatewayState,
  KillSwitchState,
  KycCase,
  McpToolName,
  McpToolResult,
  PolicySettings,
} from '../shared/index';
import { api, apiUrl } from '../api';

interface SettingsPolicyViewProps {
  policy: PolicySettings;
  killSwitch: KillSwitchState;
  aiGateway: AiGatewayState;
  activeCase: KycCase;
  onUpdatePolicy: (patch: Partial<PolicySettings>) => Promise<void>;
  onToggleKillSwitch: (active: boolean, reason?: string) => Promise<void>;
  onToggleAiOutage: (outage: boolean) => Promise<void>;
  onResetDemo: () => Promise<void>;
  notify: (title: string, message: string, isError?: boolean) => void;
}

export const SettingsPolicyView: React.FC<SettingsPolicyViewProps> = ({
  policy,
  killSwitch,
  aiGateway,
  activeCase,
  onUpdatePolicy,
  onToggleKillSwitch,
  onToggleAiOutage,
  onResetDemo,
  notify,
}) => {
  const [threshold, setThreshold] = useState(String(policy.uboThresholdPct));
  const [targetSla, setTargetSla] = useState(String(policy.targetIntakeCycleSec));
  const [rmGate, setRmGate] = useState(policy.mandatoryRmGateForOutreach);
  const [execSignOff, setExecSignOff] = useState(policy.requireExecutiveSignOffForOverrides);
  const [autoQuery, setAutoQuery] = useState(policy.autoQueryGleifAndCompaniesHouse);
  const [enclaveMode, setEnclaveMode] = useState(policy.fedRampEnclaveMode);
  const [saving, setSaving] = useState(false);

  const [killReason, setKillReason] = useState('Security alert / anomalous registry feed');
  const [mcpResult, setMcpResult] = useState<McpToolResult | null>(null);
  const [aiAssessment, setAiAssessment] = useState<{
    degradedFallback: boolean;
    executiveSummary: string;
    recommendedActions: string[];
  } | null>(null);

  useEffect(() => {
    setThreshold(String(policy.uboThresholdPct));
    setTargetSla(String(policy.targetIntakeCycleSec));
    setRmGate(policy.mandatoryRmGateForOutreach);
    setExecSignOff(policy.requireExecutiveSignOffForOverrides);
    setAutoQuery(policy.autoQueryGleifAndCompaniesHouse);
    setEnclaveMode(policy.fedRampEnclaveMode);
  }, [policy]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdatePolicy({
        uboThresholdPct: Number(threshold) || 25.0,
        targetIntakeCycleSec: Number(targetSla) || 300,
        mandatoryRmGateForOutreach: rmGate,
        requireExecutiveSignOffForOverrides: execSignOff,
        autoQueryGleifAndCompaniesHouse: autoQuery,
        fedRampEnclaveMode: enclaveMode,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInvokeMcp = async (tool: McpToolName, analystApproved = false) => {
    const res = await api.invokeMcpTool(tool, activeCase.id, analystApproved);
    setMcpResult(res);
    notify(
      res.allowed ? `MCP ${tool} Executed` : `MCP ${tool} Blocked`,
      `Gate: ${res.gatedBy}`,
      !res.allowed
    );
  };

  const handleRunAi = async () => {
    const res = await api.runAiAssess(activeCase.id);
    setAiAssessment(res);
    notify(
      res.degradedFallback ? 'AI Gateway Fallback Active' : 'AI Gateway Assessment Ready',
      'Schema-validated triage summary generated (UBO % read-only).'
    );
  };

  return (
    <div className="p-4 max-w-5xl flex flex-col gap-4">
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-secondary font-semibold">
            <span className="material-symbols-outlined text-[15px]">policy</span>
            <span>Rule Engine, Kill Switch &amp; Gated MCP Controls</span>
          </div>
          <h1 className="text-[20px] font-semibold text-on-surface mt-1">Settings &amp; Compliance Policy</h1>
          <p className="text-[12px] text-on-surface-variant">
            Manage FATF/5AMLD thresholds, emergency circuit breaker, AI Gateway outage fallback, and gated MCP tools.
          </p>
        </div>
        <a
          href={apiUrl('/api/openapi.json')}
          target="_blank"
          rel="noreferrer"
          className="h-8 px-3 rounded border border-slate-200 bg-surface-container-low hover:bg-surface-container text-[12px] font-semibold flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">api</span>
          <span>OpenAPI Spec (JSON)</span>
        </a>
      </div>

      {/* Policy Form */}
      <form
        onSubmit={handleSave}
        className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
              Qualified UBO Threshold (%)
            </label>
            <input
              type="number"
              min={5}
              max={50}
              step="0.5"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded font-mono text-[13px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
              Target Intake Cycle SLA (Sec)
            </label>
            <input
              type="number"
              min={60}
              max={1800}
              step={10}
              value={targetSla}
              onChange={(e) => setTargetSla(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded font-mono text-[13px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-on-surface-variant mb-1">
              Security Enclave Mode
            </label>
            <select
              value={enclaveMode}
              onChange={(e) => setEnclaveMode(e.target.value as PolicySettings['fedRampEnclaveMode'])}
              className="w-full h-9 px-2.5 border border-slate-300 rounded text-[12.5px] bg-white"
            >
              <option value="FEDRAMP_HIGH">FedRAMP High (Enclave East-1)</option>
              <option value="SOC2_STRICT">SOC 2 Type II Strict</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-[12.5px]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={rmGate} onChange={(e) => setRmGate(e.target.checked)} className="accent-secondary" />
            <span>Enforce Mandatory RM Governance Gate prior to client outreach</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={execSignOff} onChange={(e) => setExecSignOff(e.target.checked)} className="accent-secondary" />
            <span>Require Executive Officer (VP) cryptographic sign-off for analyst overrides</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoQuery} onChange={(e) => setAutoQuery(e.target.checked)} className="accent-secondary" />
            <span>Auto-query UK Companies House, OpenCorporates, and GLEIF APIs during intake</span>
          </label>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => void onResetDemo()}
            className="h-8 px-3 rounded border border-red-200 text-error hover:bg-error-container/40 text-[12px] font-semibold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            <span>Reset Synthetic Demo Database</span>
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-8 px-4 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold"
          >
            {saving ? 'Applying Policy...' : 'Save & Recalculate Policies'}
          </button>
        </div>
      </form>

      {/* Emergency Kill Switch & AI Gateway Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px] text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-error">emergency_home</span>
              Emergency Kill Switch
            </span>
            <span
              className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-semibold ${
                killSwitch.active
                  ? 'bg-error text-white'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              }`}
            >
              {killSwitch.active ? 'ENGAGED (FROZEN)' : 'STANDBY'}
            </span>
          </div>
          <p className="text-[12px] text-on-surface-variant">
            Halts 4-worker DAG execution and freezes outbound notifications &amp; MCP tools upon security alerts or system outages.
          </p>
          <input
            type="text"
            value={killReason}
            onChange={(e) => setKillReason(e.target.value)}
            placeholder="Circuit breaker reason..."
            className="w-full h-8 px-2.5 border border-slate-300 rounded text-[12px]"
          />
          <button
            type="button"
            onClick={() => void onToggleKillSwitch(!killSwitch.active, killReason)}
            className={`h-8 px-3 rounded text-[12px] font-semibold ${
              killSwitch.active
                ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                : 'bg-error text-white hover:bg-red-700'
            }`}
          >
            {killSwitch.active ? 'Disengage Kill Switch & Resume' : 'Engage Emergency Kill Switch'}
          </button>
        </div>

        <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[14px] text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-secondary">neurology</span>
              AI Gateway &amp; KYC Agent
            </span>
            <span
              className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-semibold ${
                aiGateway.status === 'OPERATIONAL'
                  ? 'bg-surface-container text-secondary'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {aiGateway.status}
            </span>
          </div>
          <p className="text-[12px] text-on-surface-variant">
            Schema-validated enterprise proxy ({aiGateway.modelId}). Guardrail: model output never modifies UBO equity percentages.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onToggleAiOutage(aiGateway.status === 'OPERATIONAL')}
              className="h-8 px-3 rounded border border-slate-200 bg-surface-container-low hover:bg-surface-container text-[12px] font-semibold"
            >
              {aiGateway.status === 'OPERATIONAL' ? 'Simulate Outage' : 'Restore AI Gateway'}
            </button>
            <button
              type="button"
              onClick={() => void handleRunAi()}
              className="h-8 px-3 rounded bg-primary text-white hover:bg-primary-container text-[12px] font-semibold"
            >
              Run Case Triage ({activeCase.id})
            </button>
          </div>
          {aiAssessment && (
            <div className="p-2.5 rounded bg-surface-container-low border border-slate-200 text-[11.5px]">
              <div className="font-semibold text-on-surface">{aiAssessment.executiveSummary}</div>
            </div>
          )}
        </div>
      </div>

      {/* Gated MCP Server Console */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-[14px] text-on-surface">
              Gated MCP Server (4 Governance Tools) — Active Case: {activeCase.id}
            </span>
            <p className="text-[11.5px] text-on-surface-variant">
              Test strict approval gates, biometric verdict-only boundaries, and Kill Switch enforcement.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleInvokeMcp('identity_service')}
            className="h-8 px-3 rounded border border-slate-200 bg-surface-container-low hover:bg-surface-container font-mono text-[11.5px] font-semibold"
          >
            identity_service (Verdicts Only)
          </button>
          <button
            type="button"
            onClick={() => void handleInvokeMcp('case_system')}
            className="h-8 px-3 rounded border border-slate-200 bg-surface-container-low hover:bg-surface-container font-mono text-[11.5px] font-semibold"
          >
            case_system (Read Sidecar)
          </button>
          <button
            type="button"
            onClick={() => void handleInvokeMcp('public_registries')}
            className="h-8 px-3 rounded border border-slate-200 bg-surface-container-low hover:bg-surface-container font-mono text-[11.5px] font-semibold"
          >
            public_registries (CH/GLEIF)
          </button>
          <button
            type="button"
            onClick={() => void handleInvokeMcp('notifications', false)}
            className="h-8 px-3 rounded border border-red-200 bg-error-container/30 hover:bg-error-container/60 font-mono text-[11.5px] font-semibold text-error"
          >
            notifications (Unapproved — Test Block)
          </button>
          <button
            type="button"
            onClick={() => void handleInvokeMcp('notifications', true)}
            className="h-8 px-3 rounded bg-primary text-white hover:bg-primary-container font-mono text-[11.5px] font-semibold"
          >
            notifications (Analyst Approved)
          </button>
        </div>

        {mcpResult && (
          <pre className="p-3 rounded bg-[#0b1524] text-slate-200 font-mono text-[11px] overflow-x-auto">
            {JSON.stringify(mcpResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};
