from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

CaseStatus = Literal[
    "Ready for Review",
    "Processing",
    "Deficiencies Pending",
    "Verified / Cleared",
    "Closed",
]

OwnershipNodeKind = Literal[
    "TARGET",
    "HOLDING_CO",
    "DIRECT_SHAREHOLDER",
    "NOMINEE_HOLDER",
    "NATURAL_PERSON",
]

UboDeterminationStatus = Literal[
    "CONFIRMED",
    "DISCREPANCY_PENDING",
    "MINORITY_EXEMPT",
    "INTERMEDIATE_TIER",
]

RegistryMatchStatus = Literal[
    "EXACT_MATCH",
    "VERIFIED",
    "ACTIVE_LEI",
    "WARNING_PENDING",
    "INDIRECT_LAYER",
    "CRITICAL_MISMATCH",
    "ACCEPTED_BY_ANALYST",
]

DeficiencySeverity = Literal["CRITICAL_BLOCKER", "STANDARD_WARNING"]

DeficiencyStatus = Literal[
    "PENDING_RM_SUBMISSION",
    "EXPIRED_DOCUMENT",
    "MISSING_FILING",
    "OUTREACH_DISPATCHED",
    "REMEDIATED",
]

WorkerStatus = Literal["COMPLETE", "RUNNING", "QUEUED", "FAILED", "ABORTED"]

AuditEventCategory = Literal[
    "ANALYST_OVERRIDE",
    "REGISTRY_QUERY",
    "UBO_CALCULATION",
    "DOCUMENT_OCR",
    "RULE_TRIGGER",
    "EXECUTIVE_SIGNOFF",
]

McpToolName = Literal[
    "identity_service",
    "case_system",
    "notifications",
    "public_registries",
]


class DeclaredProfile(BaseModel):
    docRef: str
    fullLegalName: str
    dateOfBirth: str
    citizenship: str
    declaredAddress: str
    directInterest: str


class RegistryProfile(BaseModel):
    sourceName: str
    registeredName: str
    monthYearOfBirth: str
    controlTier: str
    registeredServiceAddress: str
    votingRights: str
    registerEntryDate: str


class OwnershipNode(BaseModel):
    id: str
    parentId: Optional[str] = None
    tier: int
    kind: OwnershipNodeKind
    name: str
    legalForm: str
    jurisdiction: str
    registrationOrCitizenship: str
    directPct: float
    effectivePct: float
    formulaLabel: str
    isQualifiedUbo: bool
    holdingRoute: str
    screeningResult: str
    pscStatus: str
    addressDiscrepancy: Optional[str] = None
    declaredProfile: Optional[DeclaredProfile] = None
    registryProfile: Optional[RegistryProfile] = None
    determinationStatus: UboDeterminationStatus
    analystNotes: str
    lastVerifiedBy: Optional[str] = None
    lastVerifiedAt: Optional[str] = None


class RegistryFieldCheck(BaseModel):
    id: str
    fieldCode: str
    fieldName: str
    declaredValue: str
    declaredSource: str
    officialValue: str
    officialMeta: str
    registrySource: str
    registryId: str
    status: RegistryMatchStatus
    statusNote: str
    discrepancySummary: Optional[str] = None
    remediationSteps: Optional[list[str]] = None
    linkedDocRef: Optional[str] = None
    linkedDocExtract: Optional[str] = None
    acceptedBy: Optional[str] = None
    acceptedAt: Optional[str] = None


class OcrBoundingBox(BaseModel):
    id: str
    label: str
    clauseTitle: str
    extractedText: str
    coords: list[int]
    bboxCorners: Optional[list[int]] = None
    confidencePct: float
    status: Literal["DISCREPANCY", "VERIFIED", "FLAGGED"]
    registryConflictNote: Optional[str] = None
    fieldCodeRef: Optional[str] = None


class DocumentClause(BaseModel):
    heading: str
    body: str
    bboxId: Optional[str] = None


class DocumentPage(BaseModel):
    pageNumber: int
    headerLeft: str
    headerRight: str
    documentTitle: str
    subtitle: str
    regMeta: str
    clauses: list[DocumentClause]


class DocumentArtifact(BaseModel):
    id: str
    fileName: str
    fileType: Literal["PDF", "IMG", "XML", "CSV"]
    pageCount: int
    currentPage: int
    sha256: str
    ocrConfidencePct: float
    ocrModel: str
    status: Literal["EXTRACTED", "VERIFIED", "DISCREPANCY", "UPLOADED"]
    storedFilePath: Optional[str] = None
    analystAnnotation: str
    annotatedBy: str
    boundingBoxes: list[OcrBoundingBox] = Field(default_factory=list)
    pages: list[DocumentPage] = Field(default_factory=list)


class DeficiencyItem(BaseModel):
    id: str
    severity: DeficiencySeverity
    title: str
    description: str
    targetEntityOrPerson: str
    targetSubLabel: str
    targetIcon: Literal["domain", "person", "corporate"] = "domain"
    regulatoryRef: str
    regulatoryNote: str
    status: DeficiencyStatus
    ageDays: int
    selectedForOutreach: bool = True
    remediatedAt: Optional[str] = None
    remediatedBy: Optional[str] = None


class PipelineWorker(BaseModel):
    id: str
    name: str
    description: str
    status: WorkerStatus
    elapsedSec: int


class TraceNode(BaseModel):
    label: str
    highlight: bool = False


class PipelinePhase(BaseModel):
    phaseNumber: int
    title: str
    status: Literal["COMPLETED", "ACTIVE", "PENDING", "ABORTED"]
    durationLabel: str
    summary: str
    tags: Optional[list[str]] = None
    warningBanner: Optional[str] = None
    traceNodes: Optional[list[TraceNode]] = None


class EngineLogEntry(BaseModel):
    timestamp: str
    level: Literal["INFO", "WARN", "ERROR"]
    message: str


class LiveGrounding(BaseModel):
    fileName: str
    pageLabel: str
    clauseLabel: str
    excerpt: str
    confidencePct: float


class ProcessingPipeline(BaseModel):
    pipelineId: str
    clusterNode: str
    tierLabel: str
    submittedBy: str
    submittedAgoLabel: str
    targetSlaSec: int
    elapsedSec: int
    retryNotice: Optional[str] = None
    workers: list[PipelineWorker]
    phases: list[PipelinePhase]
    engineLogs: list[EngineLogEntry]
    liveGrounding: LiveGrounding


class OutreachDraft(BaseModel):
    subject: str
    body: str
    lastSentAt: Optional[str] = None
    sentCount: int = 0


class AuditEvent(BaseModel):
    id: str
    sequence: int
    caseId: str
    timestampUtc: str
    dateUtc: str
    category: AuditEventCategory
    categorySubLabel: str
    actorName: str
    actorBadge: str
    actorRole: str
    description: str
    metadataPills: list[str] = Field(default_factory=list)
    sourceRef: str
    sourceMeta: str
    overrideJustification: str
    previousHash: str
    hash: str


class AgentStep(BaseModel):
    stepNumber: int
    kind: Literal["PLAN", "TOOL_CALL", "GUARDRAIL", "REASON", "HUMAN_GATE"]
    title: str
    toolName: Optional[str] = None
    thought: str
    observation: str
    status: Literal["PASSED", "WARNING", "AWAITING_APPROVAL", "BLOCKED"]
    durationMs: int
    timestamp: str


class AgentRunTrace(BaseModel):
    runId: str
    caseId: str
    startedAt: str
    completedAt: str
    durationMs: int
    gateStatus: Literal[
        "AWAITING_ANALYST_APPROVAL",
        "APPROVED_BY_ANALYST",
        "BLOCKED_KILL_SWITCH",
    ]
    approvedBy: Optional[str] = None
    approvedAt: Optional[str] = None
    approvalJustification: Optional[str] = None
    aiDegradedFallback: bool
    uboPercentagesModified: Literal[False] = False
    summary: str
    steps: list[AgentStep]


class KycCase(BaseModel):
    id: str
    entityName: str
    legalForm: str
    jurisdiction: str
    identifierLabel: str
    identifierValue: str
    secondaryRef: Optional[str] = None
    documentsSummary: str
    fileCount: int
    status: CaseStatus
    cycleTimeSec: int
    assignedRmName: str
    assignedRmEmail: str
    escalationCcEmail: str
    slaDeadlineLabel: str
    createdAt: str
    updatedAt: str
    ownershipCommitted: bool = False
    ownershipCommittedAt: Optional[str] = None
    auditLocked: bool = False
    auditSignedBy: Optional[str] = None
    auditSignedAt: Optional[str] = None
    merkleRoot: str
    ownershipNodes: list[OwnershipNode]
    registryChecks: list[RegistryFieldCheck]
    registryLastSyncedAt: str
    registryLatencyMs: int
    documents: list[DocumentArtifact]
    deficiencies: list[DeficiencyItem]
    outreachDraft: OutreachDraft
    pipeline: ProcessingPipeline
    agentRuns: list[AgentRunTrace] = Field(default_factory=list)


class QueueMetrics(BaseModel):
    activeQueueCount: int
    deltaFromLastShift: int
    avgIntakeCycleSec: int
    targetCycleSec: int
    discrepancyRatePct: float
    flaggedUboPct: float
    slaCompliancePct: float
    slaPassedCount: int
    slaTotalCount: int
    statusCounts: dict[str, int]


class CasesListResponse(BaseModel):
    cases: list[KycCase]
    metrics: QueueMetrics


class PolicySettings(BaseModel):
    uboThresholdPct: float = 25.0
    targetIntakeCycleSec: int = 300
    mandatoryRmGateForOutreach: bool = True
    requireExecutiveSignOffForOverrides: bool = True
    autoQueryGleifAndCompaniesHouse: bool = True
    fedRampEnclaveMode: Literal["FEDRAMP_HIGH", "SOC2_STRICT"] = "FEDRAMP_HIGH"
    ruleEngineVersion: str = "FATF / 5AMLD Rule Engine v4.2"
    updatedAt: str
    updatedBy: str


class AuditVerificationResult(BaseModel):
    caseId: str
    valid: bool
    checkedCount: int
    brokenAtSequence: Optional[int] = None
    merkleRoot: str
    verifiedAt: str


class BiometricLivenessVerdict(BaseModel):
    subjectName: str
    role: str
    verdict: Literal["LIVENESS_PASS", "DOCUMENT_EXPIRED", "PENDING"]
    checkedAt: str
    telemetryStored: Literal[False] = False


class KillSwitchState(BaseModel):
    active: bool = False
    reason: Optional[str] = None
    activatedBy: Optional[str] = None
    activatedAt: Optional[str] = None


class AiGatewayState(BaseModel):
    status: Literal["OPERATIONAL", "CIRCUIT_BREAKER_OPEN"] = "OPERATIONAL"
    modelId: str = "northgate-kyc-proxy-v4.2"
    schemaValidation: Literal["STRICT"] = "STRICT"
    uboOverrideGuardrail: Literal["ENFORCED_READONLY"] = "ENFORCED_READONLY"
    lastSimulatedOutageAt: Optional[str] = None


class McpToolResult(BaseModel):
    tool: McpToolName
    allowed: bool
    gatedBy: str
    timestamp: str
    payload: Any
