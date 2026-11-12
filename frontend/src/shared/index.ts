export type NorthgateView =
  | 'intake-queue'
  | 'processing-state'
  | 'ownership-workbench'
  | 'registry-reconciliation'
  | 'document-viewer'
  | 'deficiency-punch-list'
  | 'audit-trail'
  | 'settings-policy';

export type CaseStatus =
  | 'Ready for Review'
  | 'Processing'
  | 'Deficiencies Pending'
  | 'Verified / Cleared'
  | 'Closed';

export type OwnershipNodeKind =
  | 'TARGET'
  | 'HOLDING_CO'
  | 'DIRECT_SHAREHOLDER'
  | 'NOMINEE_HOLDER'
  | 'NATURAL_PERSON';

export type UboDeterminationStatus =
  | 'CONFIRMED'
  | 'DISCREPANCY_PENDING'
  | 'MINORITY_EXEMPT'
  | 'INTERMEDIATE_TIER';

export interface OwnershipNode {
  id: string;
  parentId: string | null;
  tier: number;
  kind: OwnershipNodeKind;
  name: string;
  legalForm: string;
  jurisdiction: string;
  registrationOrCitizenship: string;
  directPct: number;
  effectivePct: number;
  formulaLabel: string;
  isQualifiedUbo: boolean;
  holdingRoute: string;
  screeningResult: string;
  pscStatus: string;
  addressDiscrepancy?: string;
  declaredProfile?: {
    docRef: string;
    fullLegalName: string;
    dateOfBirth: string;
    citizenship: string;
    declaredAddress: string;
    directInterest: string;
  };
  registryProfile?: {
    sourceName: string;
    registeredName: string;
    monthYearOfBirth: string;
    controlTier: string;
    registeredServiceAddress: string;
    votingRights: string;
    registerEntryDate: string;
  };
  determinationStatus: UboDeterminationStatus;
  analystNotes: string;
  lastVerifiedBy?: string;
  lastVerifiedAt?: string;
}

export type RegistryMatchStatus =
  | 'EXACT_MATCH'
  | 'VERIFIED'
  | 'ACTIVE_LEI'
  | 'WARNING_PENDING'
  | 'INDIRECT_LAYER'
  | 'CRITICAL_MISMATCH'
  | 'ACCEPTED_BY_ANALYST';

export interface RegistryFieldCheck {
  id: string;
  fieldCode: string;
  fieldName: string;
  declaredValue: string;
  declaredSource: string;
  officialValue: string;
  officialMeta: string;
  registrySource: string;
  registryId: string;
  status: RegistryMatchStatus;
  statusNote: string;
  discrepancySummary?: string;
  remediationSteps?: string[];
  linkedDocRef?: string;
  linkedDocExtract?: string;
  acceptedBy?: string;
  acceptedAt?: string;
}

export interface OcrBoundingBox {
  id: string;
  label: string;
  clauseTitle: string;
  extractedText: string;
  coords: [number, number, number, number];
  bboxCorners?: [number, number, number, number]; // [x1, y1, x2, y2]
  confidencePct: number;
  status: 'DISCREPANCY' | 'VERIFIED' | 'FLAGGED';
  registryConflictNote?: string;
  fieldCodeRef?: string;
}

export interface DocumentClause {
  heading: string;
  body: string;
  bboxId?: string;
}

export interface DocumentPage {
  pageNumber: number;
  headerLeft: string;
  headerRight: string;
  documentTitle: string;
  subtitle: string;
  regMeta: string;
  clauses: DocumentClause[];
}

export interface DocumentArtifact {
  id: string;
  fileName: string;
  fileType: 'PDF' | 'IMG' | 'XML' | 'CSV';
  pageCount: number;
  currentPage: number;
  sha256: string;
  ocrConfidencePct: number;
  ocrModel: string;
  status: 'EXTRACTED' | 'VERIFIED' | 'DISCREPANCY' | 'UPLOADED';
  storedFilePath?: string;
  analystAnnotation: string;
  annotatedBy: string;
  boundingBoxes: OcrBoundingBox[];
  pages: DocumentPage[];
}

export type DeficiencySeverity = 'CRITICAL_BLOCKER' | 'STANDARD_WARNING';

export type DeficiencyStatus =
  | 'PENDING_RM_SUBMISSION'
  | 'EXPIRED_DOCUMENT'
  | 'MISSING_FILING'
  | 'OUTREACH_DISPATCHED'
  | 'REMEDIATED';

export interface DeficiencyItem {
  id: string;
  severity: DeficiencySeverity;
  title: string;
  description: string;
  targetEntityOrPerson: string;
  targetSubLabel: string;
  targetIcon: 'domain' | 'person' | 'corporate';
  regulatoryRef: string;
  regulatoryNote: string;
  status: DeficiencyStatus;
  ageDays: number;
  selectedForOutreach: boolean;
  remediatedAt?: string;
  remediatedBy?: string;
}

export type WorkerStatus = 'COMPLETE' | 'RUNNING' | 'QUEUED' | 'FAILED' | 'ABORTED';

export interface PipelineWorker {
  id: string;
  name: string;
  description: string;
  status: WorkerStatus;
  elapsedSec: number;
}

export interface PipelinePhase {
  phaseNumber: number;
  title: string;
  status: 'COMPLETED' | 'ACTIVE' | 'PENDING' | 'ABORTED';
  durationLabel: string;
  summary: string;
  tags?: string[];
  warningBanner?: string;
  traceNodes?: Array<{ label: string; highlight?: boolean }>;
}

export interface ProcessingPipeline {
  pipelineId: string;
  clusterNode: string;
  tierLabel: string;
  submittedBy: string;
  submittedAgoLabel: string;
  targetSlaSec: number;
  elapsedSec: number;
  retryNotice?: string;
  workers: PipelineWorker[];
  phases: PipelinePhase[];
  engineLogs: Array<{
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    message: string;
  }>;
  liveGrounding: {
    fileName: string;
    pageLabel: string;
    clauseLabel: string;
    excerpt: string;
    confidencePct: number;
  };
}

export type AuditEventCategory =
  | 'ANALYST_OVERRIDE'
  | 'REGISTRY_QUERY'
  | 'UBO_CALCULATION'
  | 'DOCUMENT_OCR'
  | 'RULE_TRIGGER'
  | 'EXECUTIVE_SIGNOFF';

export interface AuditEvent {
  id: string;
  sequence: number;
  caseId: string;
  timestampUtc: string;
  dateUtc: string;
  category: AuditEventCategory;
  categorySubLabel: string;
  actorName: string;
  actorBadge: string;
  actorRole: string;
  description: string;
  metadataPills: string[];
  sourceRef: string;
  sourceMeta: string;
  overrideJustification: string;
  previousHash: string;
  hash: string;
}

export interface KycCase {
  id: string;
  entityName: string;
  legalForm: string;
  jurisdiction: string;
  identifierLabel: string;
  identifierValue: string;
  secondaryRef?: string;
  documentsSummary: string;
  fileCount: number;
  status: CaseStatus;
  cycleTimeSec: number;
  assignedRmName: string;
  assignedRmEmail: string;
  escalationCcEmail: string;
  slaDeadlineLabel: string;
  createdAt: string;
  updatedAt: string;
  ownershipCommitted: boolean;
  ownershipCommittedAt?: string;
  auditLocked: boolean;
  auditSignedBy?: string;
  auditSignedAt?: string;
  merkleRoot: string;
  ownershipNodes: OwnershipNode[];
  registryChecks: RegistryFieldCheck[];
  registryLastSyncedAt: string;
  registryLatencyMs: number;
  documents: DocumentArtifact[];
  deficiencies: DeficiencyItem[];
  outreachDraft: {
    subject: string;
    body: string;
    lastSentAt?: string;
    sentCount: number;
  };
  pipeline: ProcessingPipeline;
  agentRuns?: AgentRunTrace[];
}

export interface QueueMetrics {
  activeQueueCount: number;
  deltaFromLastShift: number;
  avgIntakeCycleSec: number;
  targetCycleSec: number;
  discrepancyRatePct: number;
  flaggedUboPct: number;
  slaCompliancePct: number;
  slaPassedCount: number;
  slaTotalCount: number;
  statusCounts: Record<'all' | CaseStatus, number>;
}

export interface CasesListResponse {
  cases: KycCase[];
  metrics: QueueMetrics;
}

export interface PolicySettings {
  uboThresholdPct: number;
  targetIntakeCycleSec: number;
  mandatoryRmGateForOutreach: boolean;
  requireExecutiveSignOffForOverrides: boolean;
  autoQueryGleifAndCompaniesHouse: boolean;
  fedRampEnclaveMode: 'FEDRAMP_HIGH' | 'SOC2_STRICT';
  ruleEngineVersion: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AuditVerificationResult {
  caseId: string;
  valid: boolean;
  checkedCount: number;
  brokenAtSequence: number | null;
  merkleRoot: string;
  verifiedAt: string;
}

export type McpToolName =
  | 'identity_service'
  | 'case_system'
  | 'notifications'
  | 'public_registries';

export interface BiometricLivenessVerdict {
  subjectName: string;
  role: string;
  verdict: 'LIVENESS_PASS' | 'DOCUMENT_EXPIRED' | 'PENDING';
  checkedAt: string;
  telemetryStored: false;
}

export interface KillSwitchState {
  active: boolean;
  reason?: string;
  activatedBy?: string;
  activatedAt?: string;
}

export interface AiGatewayState {
  status: 'OPERATIONAL' | 'CIRCUIT_BREAKER_OPEN';
  modelId: string;
  schemaValidation: 'STRICT';
  uboOverrideGuardrail: 'ENFORCED_READONLY';
  lastSimulatedOutageAt?: string;
}

export interface McpToolResult {
  tool: McpToolName;
  allowed: boolean;
  gatedBy: string;
  timestamp: string;
  payload: unknown;
}

export type AgentStepKind = 'PLAN' | 'TOOL_CALL' | 'GUARDRAIL' | 'REASON' | 'HUMAN_GATE';

export interface AgentStep {
  stepNumber: number;
  kind: AgentStepKind;
  title: string;
  toolName?: string;
  thought: string;
  observation: string;
  status: 'PASSED' | 'WARNING' | 'AWAITING_APPROVAL' | 'BLOCKED';
  durationMs: number;
  timestamp: string;
}

export interface AgentRunTrace {
  runId: string;
  caseId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  gateStatus: 'AWAITING_ANALYST_APPROVAL' | 'APPROVED_BY_ANALYST' | 'BLOCKED_KILL_SWITCH';
  approvedBy?: string;
  approvedAt?: string;
  approvalJustification?: string;
  aiDegradedFallback: boolean;
  uboPercentagesModified: false;
  summary: string;
  steps: AgentStep[];
}

export { recalculateOwnershipTree, computeDirectOwnershipSum } from './ubo';
