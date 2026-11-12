import type {
  AgentRunTrace,
  AiGatewayState,
  AuditEvent,
  AuditEventCategory,
  AuditVerificationResult,
  CasesListResponse,
  DeficiencyItem,
  KillSwitchState,
  KycCase,
  McpToolName,
  McpToolResult,
  OwnershipNode,
  PolicySettings,
  UboDeterminationStatus,
} from './shared/index';

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(url), init);
  if (!res.ok) {
    const errText = await res.text();
    let msg = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(errText) as { error?: string };
      if (parsed.error) msg = parsed.error;
    } catch {
      if (errText) msg = errText;
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  listCases(params?: { status?: string; jurisdiction?: string; q?: string }): Promise<CasesListResponse> {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== 'all') qs.set('status', params.status);
    if (params?.jurisdiction && params.jurisdiction !== 'all') qs.set('jurisdiction', params.jurisdiction);
    if (params?.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<CasesListResponse>(`/api/cases${suffix}`);
  },

  getCase(caseId: string): Promise<{ case: KycCase; auditEvents: AuditEvent[] }> {
    return requestJson<{ case: KycCase; auditEvents: AuditEvent[] }>(`/api/cases/${encodeURIComponent(caseId)}`);
  },

  uploadBundle(formData: FormData): Promise<KycCase> {
    return requestJson<KycCase>('/api/cases/upload-bundle', {
      method: 'POST',
      body: formData,
    });
  },

  advanceProcessing(caseId: string): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/processing/advance`, {
      method: 'POST',
    });
  },

  abortProcessing(caseId: string): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/processing/abort`, {
      method: 'POST',
    });
  },

  retryProcessing(caseId: string): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/processing/retry`, {
      method: 'POST',
    });
  },

  addOwnershipNode(
    caseId: string,
    payload: {
      parentId: string;
      name: string;
      kind: OwnershipNode['kind'];
      legalForm: string;
      jurisdiction: string;
      directPct: number;
      analystNotes?: string;
    }
  ): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/ownership/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  updateOwnershipNode(
    caseId: string,
    nodeId: string,
    payload: {
      determinationStatus?: UboDeterminationStatus;
      analystNotes?: string;
      directPct?: number;
    }
  ): Promise<KycCase> {
    return requestJson<KycCase>(
      `/api/cases/${encodeURIComponent(caseId)}/ownership/nodes/${encodeURIComponent(nodeId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  },

  commitOwnership(caseId: string): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/ownership/commit`, {
      method: 'POST',
    });
  },

  refreshRegistry(caseId: string): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/registry/refresh`, {
      method: 'POST',
    });
  },

  acceptRegistryField(caseId: string, fieldId: string): Promise<KycCase> {
    return requestJson<KycCase>(
      `/api/cases/${encodeURIComponent(caseId)}/registry/fields/${encodeURIComponent(fieldId)}/accept`,
      { method: 'POST' }
    );
  },

  acceptVerifiedRegistryFields(caseId: string): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/registry/accept-verified`, {
      method: 'POST',
    });
  },

  createDeficiencyFromField(caseId: string, fieldId: string): Promise<KycCase> {
    return requestJson<KycCase>(
      `/api/cases/${encodeURIComponent(caseId)}/registry/fields/${encodeURIComponent(fieldId)}/create-deficiency`,
      { method: 'POST' }
    );
  },

  saveDocumentAnnotation(caseId: string, docId: string, annotation: string): Promise<KycCase> {
    return requestJson<KycCase>(
      `/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(docId)}/annotation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotation }),
      }
    );
  },

  flagDocumentDeficiency(caseId: string, docId: string, bboxId?: string): Promise<KycCase> {
    return requestJson<KycCase>(
      `/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(docId)}/flag-deficiency`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bboxId }),
      }
    );
  },

  addDeficiency(caseId: string, payload: Partial<DeficiencyItem>): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/deficiencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  updateDeficiency(caseId: string, itemId: string, patch: Partial<DeficiencyItem>): Promise<KycCase> {
    return requestJson<KycCase>(
      `/api/cases/${encodeURIComponent(caseId)}/deficiencies/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }
    );
  },

  sendDeficiencyOutreach(
    caseId: string,
    payload: {
      subject?: string;
      body?: string;
      assignedRmEmail?: string;
      escalationCcEmail?: string;
    }
  ): Promise<KycCase> {
    return requestJson<KycCase>(`/api/cases/${encodeURIComponent(caseId)}/deficiencies/outreach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  getAudit(
    caseId: string,
    params?: { category?: string; q?: string }
  ): Promise<{
    events: AuditEvent[];
    counts: Record<'ALL' | AuditEventCategory, number>;
    merkleRoot: string;
    auditLocked: boolean;
    auditSignedBy?: string;
    auditSignedAt?: string;
  }> {
    const qs = new URLSearchParams();
    if (params?.category && params.category !== 'ALL') qs.set('category', params.category);
    if (params?.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson(`/api/cases/${encodeURIComponent(caseId)}/audit${suffix}`);
  },

  verifyAudit(caseId: string): Promise<AuditVerificationResult> {
    return requestJson<AuditVerificationResult>(`/api/cases/${encodeURIComponent(caseId)}/audit/verify`, {
      method: 'POST',
    });
  },

  signOffAudit(
    caseId: string,
    payload: { action: 'APPROVE_LOCK' | 'REJECT_OVERRIDE'; officerName?: string; reason?: string }
  ): Promise<{ case: KycCase; auditEvents: AuditEvent[] }> {
    return requestJson(`/api/cases/${encodeURIComponent(caseId)}/audit/sign-off`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  getPolicy(): Promise<PolicySettings> {
    return requestJson<PolicySettings>('/api/policy');
  },

  updatePolicy(patch: Partial<PolicySettings>): Promise<PolicySettings> {
    return requestJson<PolicySettings>('/api/policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  },

  resetDemo(): Promise<CasesListResponse> {
    return requestJson<CasesListResponse>('/api/system/reset', { method: 'POST' });
  },

  getKillSwitch(): Promise<KillSwitchState> {
    return requestJson<KillSwitchState>('/api/governance/kill-switch');
  },

  setKillSwitch(active: boolean, reason?: string): Promise<KillSwitchState> {
    return requestJson<KillSwitchState>('/api/governance/kill-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active, reason }),
    });
  },

  getAiGateway(): Promise<AiGatewayState> {
    return requestJson<AiGatewayState>('/api/governance/ai-gateway');
  },

  toggleAiOutage(outage: boolean): Promise<AiGatewayState> {
    return requestJson<AiGatewayState>('/api/governance/ai-gateway/toggle-outage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outage }),
    });
  },

  runAiAssess(caseId: string): Promise<{
    caseId: string;
    degradedFallback: boolean;
    executiveSummary: string;
    recommendedActions: string[];
  }> {
    return requestJson(`/api/governance/ai-gateway/cases/${encodeURIComponent(caseId)}/assess`, {
      method: 'POST',
    });
  },

  invokeMcpTool(
    tool: McpToolName,
    caseId: string,
    analystApproved = false
  ): Promise<McpToolResult> {
    return fetch(apiUrl('/api/mcp/invoke'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, caseId, analystApproved }),
    }).then((r) => r.json() as Promise<McpToolResult>);
  },

  runAgentWorkflow(caseId: string): Promise<AgentRunTrace> {
    return requestJson<AgentRunTrace>(`/api/cases/${encodeURIComponent(caseId)}/agent/run`, {
      method: 'POST',
    });
  },

  approveAgentGate(
    caseId: string,
    payload: { runId: string; analystName?: string; justification: string }
  ): Promise<AgentRunTrace> {
    return requestJson<AgentRunTrace>(`/api/cases/${encodeURIComponent(caseId)}/agent/approve-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};

export function formatDurationSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
