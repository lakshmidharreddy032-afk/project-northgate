from __future__ import annotations

import csv
import io
import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel

from app.agent.kyc_agent import approve_agent_gate, run_agentic_kyc_workflow
from app.ai_gateway.gateway import run_ai_triage_assessment
from app.audit.worm_log import GENESIS_HASH, compute_file_sha256, verify_chain_integrity
from app.mcp.gated_tools import MCP_TOOLS, invoke_gated_mcp_tool
from app.models.schemas import (
    DeficiencyItem,
    DocumentArtifact,
    EngineLogEntry,
    KycCase,
    LiveGrounding,
    McpToolName,
    OutreachDraft,
    OwnershipNode,
    PipelinePhase,
    PipelineWorker,
    ProcessingPipeline,
    RegistryFieldCheck,
    UboDeterminationStatus,
)
from app.models.ubo import recalculate_ownership_tree
from app.ocr.leptos_ocr import build_uploaded_artifact
from app.orchestrator.outreach import build_outreach_draft, refresh_case_outreach_draft
from app.orchestrator.store import NorthgateStore


class AddNodeRequest(BaseModel):
    parentId: str
    name: str
    kind: str = "NATURAL_PERSON"
    legalForm: str = "Natural Person"
    jurisdiction: str = "United Kingdom (GB)"
    directPct: float
    analystNotes: Optional[str] = None


class UpdateNodeRequest(BaseModel):
    determinationStatus: Optional[UboDeterminationStatus] = None
    analystNotes: Optional[str] = None
    directPct: Optional[float] = None


class AnnotationRequest(BaseModel):
    annotation: str = ""


class FlagDeficiencyRequest(BaseModel):
    bboxId: Optional[str] = None


class CreateDeficiencyRequest(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "CRITICAL_BLOCKER"
    targetEntityOrPerson: Optional[str] = None
    targetSubLabel: Optional[str] = None
    targetIcon: str = "domain"
    regulatoryRef: Optional[str] = None
    regulatoryNote: Optional[str] = None


class UpdateDeficiencyRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    selectedForOutreach: Optional[bool] = None
    status: Optional[str] = None


class OutreachRequest(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    assignedRmEmail: Optional[str] = None
    escalationCcEmail: Optional[str] = None


class SignOffRequest(BaseModel):
    action: str = "APPROVE_LOCK"
    officerName: Optional[str] = None
    reason: Optional[str] = None


class KillSwitchRequest(BaseModel):
    active: bool
    reason: Optional[str] = None


class ToggleOutageRequest(BaseModel):
    outage: bool


class McpInvokeRequest(BaseModel):
    tool: McpToolName
    caseId: str
    analystApproved: bool = False


class AgentApproveGateRequest(BaseModel):
    runId: str
    analystName: str = "Marcus Vance"
    justification: str


def create_app(
    *,
    db_path: Path | str | None = None,
    uploads_dir: Path | str | None = None,
) -> FastAPI:
    app = FastAPI(
        title="Project Northgate — Institutional KYC/AML API",
        version="4.2.0",
        description=(
            "FastAPI backend for 4-Worker DAG Intake, Agentic KYC AI Workflow, "
            "FATF/5AMLD Ownership Reconciliation, Public Registry Verification, "
            "Gated MCP Tools, and SHA-256 WORM Audit Trails."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    store = NorthgateStore(db_path=db_path)
    upload_root = Path(uploads_dir) if uploads_dir else Path(__file__).resolve().parents[1] / "uploads"
    upload_root.mkdir(parents=True, exist_ok=True)

    @app.get("/health")
    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "enclave": store.get_policy().fedRampEnclaveMode,
            "traceabilityEngine": "v4.2",
            "killSwitchActive": store.get_kill_switch().active,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # =========================================================================
    # INTAKE QUEUE & BUNDLE UPLOAD
    # =========================================================================
    @app.get("/api/cases")
    def list_cases(
        status: Optional[str] = None,
        jurisdiction: Optional[str] = None,
        q: Optional[str] = None,
    ):
        return store.list_cases(status=status, jurisdiction=jurisdiction, q=q)

    @app.get("/api/cases/export-ledger")
    def export_ledger() -> Response:
        res = store.list_cases()
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "CASE_ID",
                "ENTITY_NAME",
                "LEGAL_FORM",
                "JURISDICTION",
                "IDENTIFIER",
                "FILES",
                "STATUS",
                "CYCLE_TIME_SEC",
                "OPEN_DEFICIENCIES",
                "MERKLE_ROOT",
            ]
        )
        for c in res.cases:
            writer.writerow(
                [
                    c.id,
                    c.entityName,
                    c.legalForm,
                    c.jurisdiction,
                    f"{c.identifierLabel}:{c.identifierValue}",
                    c.fileCount,
                    c.status,
                    c.cycleTimeSec,
                    sum(1 for d in c.deficiencies if d.status != "REMEDIATED"),
                    c.merkleRoot,
                ]
            )
        return Response(
            content=buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="northgate-intake-ledger.csv"'},
        )

    @app.post("/api/cases/upload-bundle", status_code=201)
    async def upload_bundle(
        entityName: str = Form("Meridian Eurofreight S.A."),
        jurisdiction: str = Form("Luxembourg"),
        legalForm: str = Form("S.A."),
        identifierValue: str = Form(""),
        assignedRmName: str = Form("Sarah Lin"),
        assignedRmEmail: str = Form("sarah.lin@institutional-bank.com"),
        primaryUboName: str = Form("Claire Beaumont"),
        files: list[UploadFile] = File(default=[]),
    ) -> KycCase:
        clean_entity = entityName.strip() or "Meridian Eurofreight S.A."
        clean_id_val = identifierValue.strip() or f"B{random.randint(100000, 999999)}"
        case_id = f"CASE-2024-{random.randint(8842, 9799)}"

        artifacts: list[DocumentArtifact] = []
        if files:
            for idx, upload in enumerate(files):
                content = await upload.read()
                sha = compute_file_sha256(content)
                safe_name = "".join(
                    ch if (ch.isalnum() or ch in "._-") else "_"
                    for ch in (upload.filename or f"document_{idx}.pdf")
                )
                dest = upload_root / f"{case_id}-{idx}-{safe_name}"
                dest.write_bytes(content)
                artifacts.append(
                    build_uploaded_artifact(
                        case_id, idx, upload.filename or safe_name, sha, str(dest)
                    )
                )
        else:
            safe_file = "".join(ch if ch.isalnum() else "_" for ch in clean_entity)
            sha = compute_file_sha256(f"{case_id}-{clean_entity}".encode("utf-8"))
            artifacts.append(
                build_uploaded_artifact(case_id, 0, f"{safe_file}_Articles_Packet.pdf", sha)
            )

        nodes = recalculate_ownership_tree(
            [
                OwnershipNode(
                    id=f"node-target-{case_id}",
                    parentId=None,
                    tier=0,
                    kind="TARGET",
                    name=clean_entity,
                    legalForm=legalForm,
                    jurisdiction=jurisdiction,
                    registrationOrCitizenship=f"{jurisdiction} • Reg #{clean_id_val}",
                    directPct=100.0,
                    effectivePct=100.0,
                    formulaLabel="100.0% Direct Target",
                    isQualifiedUbo=False,
                    holdingRoute="Root Operating Target",
                    screeningResult="Pending Registry Sync",
                    pscStatus="Operating Entity",
                    determinationStatus="CONFIRMED",
                    analystNotes="Ingested via Onboarding Package Bundle Dropzone.",
                ),
                OwnershipNode(
                    id=f"node-ubo-{case_id}-1",
                    parentId=f"node-target-{case_id}",
                    tier=1,
                    kind="NATURAL_PERSON",
                    name=primaryUboName.strip() or "Claire Beaumont",
                    legalForm="Natural Person",
                    jurisdiction=jurisdiction,
                    registrationOrCitizenship=f"Citizenship: {jurisdiction}",
                    directPct=52.0,
                    effectivePct=52.0,
                    formulaLabel="Direct Equity: 52.00%",
                    isQualifiedUbo=True,
                    holdingRoute="Direct Shareholder (52.0%)",
                    screeningResult="PEP / Sanctions Clean",
                    pscStatus="Qualified UBO (>=25%)",
                    determinationStatus="CONFIRMED",
                    analystNotes="Extracted automatically by Entity Parser v2.8.",
                ),
                OwnershipNode(
                    id=f"node-ubo-{case_id}-2",
                    parentId=f"node-target-{case_id}",
                    tier=1,
                    kind="DIRECT_SHAREHOLDER",
                    name="Nordic Institutional Partners",
                    legalForm="Corporate Investor",
                    jurisdiction="Luxembourg",
                    registrationOrCitizenship="LU • Institutional LP",
                    directPct=48.0,
                    effectivePct=48.0,
                    formulaLabel="48.0% Direct",
                    isQualifiedUbo=False,
                    holdingRoute="Direct Investor (48.0%)",
                    screeningResult="Regulated Fund Exempt",
                    pscStatus="Institutional LP",
                    determinationStatus="INTERMEDIATE_TIER",
                    analystNotes="Pending look-through attestation if any LP > 25%.",
                ),
            ],
            store.get_policy().uboThresholdPct,
        )

        deficiencies = [
            DeficiencyItem(
                id=f"DEF-{case_id}-1",
                severity="STANDARD_WARNING",
                title="Certified Register of Members Confirmation",
                description="Verify investor look-through exemption for 48% corporate shareholder.",
                targetEntityOrPerson=clean_entity,
                targetSubLabel=legalForm,
                targetIcon="domain",
                regulatoryRef="FATF Rec 10 / 5AMLD",
                regulatoryNote="Auto-flagged on bundle intake",
                status="PENDING_RM_SUBMISSION",
                ageDays=1,
                selectedForOutreach=True,
            )
        ]

        subj, body = build_outreach_draft(
            case_id, clean_entity, assignedRmName, "25 Nov 2024", deficiencies
        )
        now_iso = datetime.now(timezone.utc).isoformat()
        new_case = KycCase(
            id=case_id,
            entityName=clean_entity,
            legalForm=legalForm,
            jurisdiction=jurisdiction,
            identifierLabel="REG",
            identifierValue=clean_id_val,
            documentsSummary=", ".join(a.fileName for a in artifacts),
            fileCount=len(artifacts),
            status="Processing",
            cycleTimeSec=12,
            assignedRmName=assignedRmName,
            assignedRmEmail=assignedRmEmail,
            escalationCcEmail="compliance-ops-tier1@bank.internal",
            slaDeadlineLabel="25 Nov 2024",
            createdAt=now_iso,
            updatedAt=now_iso,
            merkleRoot=GENESIS_HASH,
            ownershipNodes=nodes,
            registryLastSyncedAt="Queued for sync",
            registryLatencyMs=0,
            registryChecks=[
                RegistryFieldCheck(
                    id=f"REG-{case_id}-1",
                    fieldCode="REG.ENTITY_01",
                    fieldName="Legal Entity Name",
                    declaredValue=clean_entity,
                    declaredSource="Uploaded Bundle",
                    officialValue=clean_entity.upper(),
                    officialMeta="Pending Final Verification",
                    registrySource=f"{jurisdiction} Business Registry",
                    registryId=clean_id_val,
                    status="EXACT_MATCH",
                    statusNote="Normalized string match",
                )
            ],
            documents=artifacts,
            deficiencies=deficiencies,
            outreachDraft=OutreachDraft(subject=subj, body=body, sentCount=0),
            pipeline=ProcessingPipeline(
                pipelineId=f"DAG-{case_id}",
                clusterNode="LON-PROD-04",
                tierLabel="TIER-1 INSTITUTIONAL PIPELINE",
                submittedBy=f"{assignedRmName} (Relationship Mgr)",
                submittedAgoLabel="Submitted just now",
                targetSlaSec=90,
                elapsedSec=12,
                workers=[
                    PipelineWorker(id="w-parser", name="Entity Parser", description="Identifies entities and natural persons in the ownership chain.", status="COMPLETE", elapsedSec=8),
                    PipelineWorker(id="w-registry", name="Registry Lookup", description="Queries public registry data for the operating entity.", status="RUNNING", elapsedSec=4),
                    PipelineWorker(id="w-ubo", name="Ownership Reconciliation", description="Compares declared ownership against registry records.", status="QUEUED", elapsedSec=0),
                    PipelineWorker(id="w-scanner", name="Document Scanner", description="Checks the packet for missing core components.", status="QUEUED", elapsedSec=0),
                ],
                phases=[
                    PipelinePhase(phaseNumber=1, title="Parsing entities and natural persons", status="COMPLETED", durationLabel="8.0s", summary=f"Ingested {len(artifacts)} file(s) and extracted entity {clean_entity}."),
                    PipelinePhase(phaseNumber=2, title="Querying public company registry", status="ACTIVE", durationLabel="4.0s elapsed", summary=f"Connecting to {jurisdiction} Registry & GLEIF API..."),
                    PipelinePhase(phaseNumber=3, title="Reconciling ownership & UBO calculation", status="PENDING", durationLabel="Queued", summary="Awaiting registry lookup completion."),
                    PipelinePhase(phaseNumber=4, title="Scanning for missing documents & compliance checks", status="PENDING", durationLabel="Queued", summary="Scheduled PEP, Sanctions, and statutory filing checks."),
                ],
                engineLogs=[
                    EngineLogEntry(timestamp="00:01.0", level="INFO", message=f"Intake bundle received for {clean_entity} ({case_id})."),
                    EngineLogEntry(timestamp="00:08.0", level="INFO", message=f"OCR complete on {len(artifacts)} file(s). SHA-256 checksums recorded."),
                    EngineLogEntry(timestamp="00:10.2", level="INFO", message=f"Dispatching Registry Lookup worker for {jurisdiction}..."),
                ],
                liveGrounding=LiveGrounding(
                    fileName=artifacts[0].fileName,
                    pageLabel="Page 1 of 1",
                    clauseLabel="Entity Header",
                    excerpt=f"Extracted target entity {clean_entity} ({clean_id_val}) from uploaded package.",
                    confidencePct=98.5,
                ),
            ),
        )

        store.add_case(new_case)
        store.append_audit(
            case_id=case_id,
            category="DOCUMENT_OCR",
            category_sub_label="Bundle Ingestion",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Deposited onboarding package bundle ({len(artifacts)} file(s)) for {clean_entity}.",
            metadata_pills=[f"SHA-256: {artifacts[0].sha256[:12]}...", f"Jurisdiction: {jurisdiction}"],
            source_ref=artifacts[0].fileName,
            source_meta="Intake Dropzone Upload",
            override_justification="Standard intake pipeline initiated.",
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.get("/api/cases/{case_id}")
    def get_case(case_id: str) -> dict[str, Any]:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        return {"case": kyc_case, "auditEvents": store.get_audit_events(case_id)}

    # =========================================================================
    # PROCESSING STATE DAG & AGENTIC AI WORKFLOW
    # =========================================================================
    @app.post("/api/cases/{case_id}/processing/advance")
    def advance_processing(case_id: str) -> KycCase:
        ks = store.get_kill_switch()
        if ks.active:
            raise HTTPException(
                status_code=423,
                detail=f"Emergency Kill Switch active: {ks.reason or 'Worker execution halted'}",
            )
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")

        p = kyc_case.pipeline
        running_idx = next((i for i, w in enumerate(p.workers) if w.status == "RUNNING"), -1)
        if running_idx != -1:
            p.workers[running_idx].status = "COMPLETE"
            p.workers[running_idx].elapsedSec = max(p.workers[running_idx].elapsedSec, 18)
            p.phases[running_idx].status = "COMPLETED"
            p.phases[running_idx].durationLabel = f"{p.workers[running_idx].elapsedSec}.0s"
            p.engineLogs.append(
                EngineLogEntry(
                    timestamp=f"00:{p.elapsedSec + 12:02d}.4",
                    level="INFO",
                    message=f"Worker '{p.workers[running_idx].name}' completed cleanly.",
                )
            )

        next_queued = next((i for i, w in enumerate(p.workers) if w.status == "QUEUED"), -1)
        if next_queued != -1:
            p.workers[next_queued].status = "RUNNING"
            p.workers[next_queued].elapsedSec = 9
            p.phases[next_queued].status = "ACTIVE"
            p.phases[next_queued].durationLabel = "9.0s elapsed"
            p.elapsedSec += 14
            p.engineLogs.append(
                EngineLogEntry(
                    timestamp=f"00:{p.elapsedSec:02d}.0",
                    level="INFO",
                    message=f"Started worker '{p.workers[next_queued].name}'...",
                )
            )
        else:
            p.elapsedSec += 12
            p.retryNotice = None
            p.submittedAgoLabel = f"Completed in {p.elapsedSec // 60}m {p.elapsedSec % 60}s"
            kyc_case.status = (
                "Deficiencies Pending"
                if any(d.status != "REMEDIATED" for d in kyc_case.deficiencies)
                else "Ready for Review"
            )
            kyc_case.registryLastSyncedAt = f"Today @ {datetime.now(timezone.utc).strftime('%H:%M:%S')} UTC"
            kyc_case.registryLatencyMs = 138
            p.engineLogs.append(
                EngineLogEntry(
                    timestamp=f"00:{p.elapsedSec:02d}.8",
                    level="INFO",
                    message=f"All 4 DAG workers finished. Case transitioned to '{kyc_case.status}'.",
                )
            )
            store.append_audit(
                case_id=case_id,
                category="RULE_TRIGGER",
                category_sub_label="DAG Pipeline Complete",
                actor_name="Orchestrator",
                actor_badge="OR",
                actor_role="v2.4 Orchestrator",
                description=f"All 4 intake & reconciliation workers completed for {kyc_case.entityName}.",
                metadata_pills=[f"Status: {kyc_case.status}", f"Elapsed: {p.elapsedSec}s"],
                source_ref=p.pipelineId,
                source_meta=f"Cluster: {p.clusterNode}",
                override_justification="Automated DAG pipeline completion.",
            )

        store.save_case(kyc_case)
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/processing/abort")
    def abort_processing(case_id: str) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        for w in kyc_case.pipeline.workers:
            if w.status in ("RUNNING", "QUEUED"):
                w.status = "ABORTED"
        for ph in kyc_case.pipeline.phases:
            if ph.status in ("ACTIVE", "PENDING"):
                ph.status = "ABORTED"
                ph.durationLabel = "Aborted"
        kyc_case.pipeline.engineLogs.append(
            EngineLogEntry(
                timestamp=f"00:{kyc_case.pipeline.elapsedSec:02d}.9",
                level="WARN",
                message="Pipeline intake aborted by Senior Analyst Marcus Vance.",
            )
        )
        kyc_case.status = "Ready for Review"
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="ANALYST_OVERRIDE",
            category_sub_label="Pipeline Abort",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description="Manually aborted automated intake pipeline for immediate workbench inspection.",
            source_ref=kyc_case.pipeline.pipelineId,
            source_meta=f"Cluster: {kyc_case.pipeline.clusterNode}",
            override_justification="Analyst requested partial result inspection.",
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/processing/retry")
    def retry_processing(case_id: str) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        kyc_case.status = "Processing"
        for idx, w in enumerate(kyc_case.pipeline.workers):
            w.status = "COMPLETE" if idx == 0 else ("RUNNING" if idx == 1 else "QUEUED")
            w.elapsedSec = 12 if idx == 0 else (4 if idx == 1 else 0)
        for idx, ph in enumerate(kyc_case.pipeline.phases):
            ph.status = "COMPLETED" if idx == 0 else ("ACTIVE" if idx == 1 else "PENDING")
        kyc_case.pipeline.engineLogs.append(
            EngineLogEntry(
                timestamp="00:16.0",
                level="INFO",
                message="Re-dispatched DAG workers for fresh registry & UBO sweep.",
            )
        )
        store.save_case(kyc_case)
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/agent/run")
    def run_agent(case_id: str):
        if not store.get_case(case_id):
            raise HTTPException(status_code=404, detail="Case not found")
        return run_agentic_kyc_workflow(store, case_id)

    @app.get("/api/cases/{case_id}/agent/runs")
    def list_agent_runs(case_id: str):
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        return {"runs": kyc_case.agentRuns}

    @app.post("/api/cases/{case_id}/agent/approve-gate")
    def approve_agent(case_id: str, payload: AgentApproveGateRequest):
        if len(payload.justification.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="Written regulatory justification (minimum 5 characters) is mandatory to approve the agent gate.",
            )
        try:
            return approve_agent_gate(
                store,
                case_id,
                payload.runId,
                analyst_name=payload.analystName,
                justification=payload.justification.strip(),
            )
        except PermissionError as exc:
            raise HTTPException(status_code=423, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    # =========================================================================
    # OWNERSHIP WORKBENCH
    # =========================================================================
    @app.post("/api/cases/{case_id}/ownership/nodes", status_code=201)
    def add_ownership_node(case_id: str, payload: AddNodeRequest) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        if not payload.name.strip() or payload.directPct <= 0 or payload.directPct > 100:
            raise HTTPException(status_code=400, detail="Valid node name and directPct (0-100) are required")

        parent = next(
            (n for n in kyc_case.ownershipNodes if n.id == payload.parentId),
            kyc_case.ownershipNodes[0],
        )
        new_node = OwnershipNode(
            id=f"node-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            parentId=parent.id,
            tier=parent.tier + 1,
            kind=payload.kind,  # type: ignore[arg-type]
            name=payload.name.strip(),
            legalForm=payload.legalForm,
            jurisdiction=payload.jurisdiction,
            registrationOrCitizenship=f"Jurisdiction: {payload.jurisdiction}",
            directPct=payload.directPct,
            effectivePct=payload.directPct,
            formulaLabel=f"{payload.directPct:.1f}% Direct",
            isQualifiedUbo=False,
            holdingRoute=f"{parent.name} ({payload.directPct}%)",
            screeningResult="PEP / Sanctions Clean (Auto-Screened)",
            pscStatus="Pending Analyst Confirmation",
            determinationStatus="INTERMEDIATE_TIER" if payload.kind == "HOLDING_CO" else "CONFIRMED",
            analystNotes=(payload.analystNotes or "").strip() or "Added manually in Ownership Workbench.",
        )

        kyc_case.ownershipNodes = recalculate_ownership_tree(
            [*kyc_case.ownershipNodes, new_node], store.get_policy().uboThresholdPct
        )
        kyc_case.ownershipCommitted = False
        store.save_case(kyc_case)
        updated_node = next(n for n in kyc_case.ownershipNodes if n.id == new_node.id)
        store.append_audit(
            case_id=case_id,
            category="UBO_CALCULATION",
            category_sub_label="Ownership Graph Updated",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Added ownership node '{new_node.name}' ({new_node.directPct}% direct under {parent.name}).",
            metadata_pills=[f"Effective: {updated_node.effectivePct}%"],
            source_ref="Ownership_Workbench",
            source_meta=store.get_policy().ruleEngineVersion,
            override_justification=new_node.analystNotes,
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.patch("/api/cases/{case_id}/ownership/nodes/{node_id}")
    def update_ownership_node(case_id: str, node_id: str, payload: UpdateNodeRequest) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        node = next((n for n in kyc_case.ownershipNodes if n.id == node_id), None)
        if not node:
            raise HTTPException(status_code=404, detail="Ownership node not found")

        if not payload.analystNotes or len(payload.analystNotes.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="Written regulatory justification (minimum 5 characters) is mandatory for analyst overrides.",
            )

        if payload.determinationStatus:
            node.determinationStatus = payload.determinationStatus
        node.analystNotes = payload.analystNotes.strip()
        if payload.directPct is not None and 0 < payload.directPct <= 100:
            node.directPct = payload.directPct
        node.lastVerifiedBy = "Marcus Vance"
        node.lastVerifiedAt = datetime.now(timezone.utc).isoformat()

        kyc_case.ownershipNodes = recalculate_ownership_tree(
            kyc_case.ownershipNodes, store.get_policy().uboThresholdPct
        )
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="ANALYST_OVERRIDE",
            category_sub_label="UBO Determination Sign-off",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Saved verification determination ({node.determinationStatus}) for {node.name} ({node.effectivePct}% effective).",
            metadata_pills=[f"Node: {node.name}", f"Effective: {node.effectivePct}%"],
            source_ref="Ownership_Workbench",
            source_meta="Analyst Sign-off",
            override_justification=node.analystNotes,
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/ownership/commit")
    def commit_ownership(case_id: str) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        kyc_case.ownershipCommitted = True
        kyc_case.ownershipCommittedAt = datetime.now(timezone.utc).isoformat()
        if not any(d.status != "REMEDIATED" for d in kyc_case.deficiencies):
            kyc_case.status = "Verified / Cleared"
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="UBO_CALCULATION",
            category_sub_label="Structure Committed",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Committed legal ownership structure ({len(kyc_case.ownershipNodes)} nodes) under {store.get_policy().ruleEngineVersion}.",
            metadata_pills=[f"UBO Threshold: >={store.get_policy().uboThresholdPct}%"],
            source_ref="Cap_Table_Ledger",
            source_meta="FATF / 5AMLD Verified",
            override_justification="Structure committed after analyst reconciliation.",
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.get("/api/cases/{case_id}/ownership/export-csv")
    def export_cap_table_csv(case_id: str) -> Response:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["NODE_ID", "TIER", "NAME", "LEGAL_FORM", "JURISDICTION", "DIRECT_PCT", "EFFECTIVE_PCT", "QUALIFIED_UBO", "DETERMINATION"]
        )
        for n in kyc_case.ownershipNodes:
            writer.writerow(
                [n.id, n.tier, n.name, n.legalForm, n.jurisdiction, f"{n.directPct:.2f}", f"{n.effectivePct:.2f}", "YES" if n.isQualifiedUbo else "NO", n.determinationStatus]
            )
        return Response(
            content=buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{kyc_case.id}-cap-table.csv"'},
        )

    # =========================================================================
    # REGISTRY RECONCILIATION
    # =========================================================================
    @app.post("/api/cases/{case_id}/registry/refresh")
    def refresh_registry(case_id: str) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        kyc_case.registryLastSyncedAt = f"Today @ {datetime.now(timezone.utc).strftime('%H:%M:%S')} UTC"
        kyc_case.registryLatencyMs = random.randint(110, 175)
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="REGISTRY_QUERY",
            category_sub_label="Force Refresh API",
            actor_name="Engine",
            actor_badge="CH",
            actor_role="CH-Bridge-v2",
            description=f"Re-synchronized {len(kyc_case.registryChecks)} statutory fields from Companies House, GLEIF, and OpenCorporates.",
            metadata_pills=[f"Latency: {kyc_case.registryLatencyMs}ms", "HTTP 200 OK"],
            source_ref=f"/registry/sync/{case_id}",
            source_meta="REST API 200 OK",
            override_justification="Manual analyst registry refresh.",
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/registry/fields/{field_id}/accept")
    def accept_registry_field(case_id: str, field_id: str) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        field = next((f for f in kyc_case.registryChecks if f.id == field_id), None)
        if not field:
            raise HTTPException(status_code=404, detail="Registry field not found")
        field.status = "ACCEPTED_BY_ANALYST"
        field.statusNote = "Verified & Accepted by Analyst"
        field.acceptedBy = "Marcus Vance"
        field.acceptedAt = datetime.now(timezone.utc).isoformat()
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="REGISTRY_QUERY",
            category_sub_label="Field Accepted",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Accepted registry field {field.fieldCode} ({field.fieldName}).",
            source_ref=field.fieldCode,
            source_meta=field.registrySource,
            override_justification="Field verified against official statutory filing.",
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/registry/accept-verified")
    def accept_verified_fields(case_id: str) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        count = 0
        now_iso = datetime.now(timezone.utc).isoformat()
        for field in kyc_case.registryChecks:
            if field.status in ("EXACT_MATCH", "VERIFIED", "ACTIVE_LEI"):
                field.status = "ACCEPTED_BY_ANALYST"
                field.acceptedBy = "Marcus Vance"
                field.acceptedAt = now_iso
                count += 1
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="REGISTRY_QUERY",
            category_sub_label="Batch Accept Verified",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Batch accepted {count} verified registry reconciliation fields.",
            source_ref="Registry_Reconciliation_Matrix",
            source_meta=f"{count} fields locked",
            override_justification="All matched statutory fields accepted in batch.",
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/registry/fields/{field_id}/create-deficiency")
    def create_deficiency_from_field(case_id: str, field_id: str) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        field = next((f for f in kyc_case.registryChecks if f.id == field_id), None)
        if not field:
            raise HTTPException(status_code=404, detail="Registry field not found")

        if not any(field.fieldCode in d.regulatoryNote for d in kyc_case.deficiencies):
            new_def = DeficiencyItem(
                id=f"DEF-{case_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                severity="CRITICAL_BLOCKER" if field.status == "CRITICAL_MISMATCH" else "STANDARD_WARNING",
                title=f"Remediation: {field.fieldName}",
                description=field.discrepancySummary or f"{field.declaredValue} vs {field.officialValue}",
                targetEntityOrPerson=kyc_case.entityName,
                targetSubLabel=field.registrySource,
                targetIcon="domain",
                regulatoryRef=f"Registry Rule • {field.fieldCode}",
                regulatoryNote=f"{field.fieldCode}: {field.statusNote}",
                status="PENDING_RM_SUBMISSION",
                ageDays=0,
                selectedForOutreach=True,
            )
            kyc_case.deficiencies.insert(0, new_def)
            refresh_case_outreach_draft(kyc_case)
            if kyc_case.status != "Processing":
                kyc_case.status = "Deficiencies Pending"
            store.save_case(kyc_case)
            store.append_audit(
                case_id=case_id,
                category="RULE_TRIGGER",
                category_sub_label="Deficiency Escalated",
                actor_name="Marcus Vance",
                actor_badge="MV",
                actor_role="KYC Senior Analyst",
                description=f"Created Deficiency Punch List ticket for {field.fieldCode} ({field.fieldName}).",
                source_ref=field.fieldCode,
                source_meta=field.registrySource,
                override_justification="Escalated registry discrepancy to RM outreach queue.",
            )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.get("/api/cases/{case_id}/registry/export")
    def export_registry_certificate(case_id: str) -> Response:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        payload = {
            "certificateType": "PROJECT_NORTHGATE_REGISTRY_RECONCILIATION",
            "caseId": kyc_case.id,
            "entityName": kyc_case.entityName,
            "syncedAt": kyc_case.registryLastSyncedAt,
            "merkleRoot": kyc_case.merkleRoot,
            "fields": [f.model_dump() for f in kyc_case.registryChecks],
        }
        return Response(
            content=json.dumps(payload, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{kyc_case.id}-reconciliation-certificate.json"'},
        )

    # =========================================================================
    # SOURCE DOCUMENT VIEWER
    # =========================================================================
    @app.post("/api/cases/{case_id}/documents/{doc_id}/annotation")
    def save_document_annotation(case_id: str, doc_id: str, payload: AnnotationRequest) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        doc = next((d for d in kyc_case.documents if d.id == doc_id), None)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        doc.analystAnnotation = payload.annotation
        doc.annotatedBy = "Marcus Vance"
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="DOCUMENT_OCR",
            category_sub_label="Analyst Annotation",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Updated evidentiary case annotation on {doc.fileName}.",
            source_ref=doc.fileName,
            source_meta=f"SHA-256: {doc.sha256[:12]}...",
            override_justification=doc.analystAnnotation or "Annotation cleared.",
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/documents/{doc_id}/flag-deficiency")
    def flag_document_deficiency(case_id: str, doc_id: str, payload: FlagDeficiencyRequest) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        doc = next((d for d in kyc_case.documents if d.id == doc_id), None)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        bbox = next((b for b in doc.boundingBoxes if b.id == payload.bboxId), None) or (
            doc.boundingBoxes[0] if doc.boundingBoxes else None
        )
        new_def = DeficiencyItem(
            id=f"DEF-{case_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            severity="CRITICAL_BLOCKER",
            title=f"Evidentiary Flag: {bbox.clauseTitle}" if bbox else f"Document Review Flag: {doc.fileName}",
            description=(
                f"{bbox.extractedText} — {bbox.registryConflictNote or 'Flagged in Source Document Viewer'}"
                if bbox
                else f"Flagged manually during evidentiary review of {doc.fileName}."
            ),
            targetEntityOrPerson=kyc_case.entityName,
            targetSubLabel=doc.fileName,
            targetIcon="domain",
            regulatoryRef=f"OCR Bounding Box • {bbox.fieldCodeRef}" if (bbox and bbox.fieldCodeRef) else "OCR Evidentiary Review",
            regulatoryNote=f"OCR Conf {bbox.confidencePct if bbox else doc.ocrConfidencePct}%",
            status="PENDING_RM_SUBMISSION",
            ageDays=0,
            selectedForOutreach=True,
        )
        if bbox:
            bbox.status = "FLAGGED"
        doc.status = "DISCREPANCY"
        kyc_case.deficiencies.insert(0, new_def)
        refresh_case_outreach_draft(kyc_case)
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="RULE_TRIGGER",
            category_sub_label="OCR Box Flagged",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Flagged bounding region in {doc.fileName} to Deficiency Punch List.",
            source_ref=doc.fileName,
            source_meta=f"Coords {bbox.coords}" if bbox else "Document Viewer",
            override_justification=new_def.description,
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.get("/api/cases/{case_id}/documents/{doc_id}/download")
    def download_document(case_id: str, doc_id: str) -> Response:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        doc = next((d for d in kyc_case.documents if d.id == doc_id), None)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc.storedFilePath and Path(doc.storedFilePath).exists():
            return FileResponse(doc.storedFilePath, filename=doc.fileName)
        lines = [
            "PROJECT NORTHGATE — EVIDENTIARY DOCUMENT ARCHIVE",
            f"Case ID: {kyc_case.id} ({kyc_case.entityName})",
            f"Document: {doc.fileName}",
            f"SHA-256: {doc.sha256}",
            f"OCR Model: {doc.ocrModel} ({doc.ocrConfidencePct}%)",
            "",
        ]
        for p in doc.pages:
            lines.append(f"--- PAGE {p.pageNumber}: {p.documentTitle} ---")
            for cl in p.clauses:
                lines.append(f"{cl.heading}\n{cl.body}\n")
        stem = Path(doc.fileName).stem
        return PlainTextResponse(
            content="\n".join(lines),
            headers={"Content-Disposition": f'attachment; filename="{stem}-extract.txt"'},
        )

    # =========================================================================
    # DEFICIENCY PUNCH LIST & REMEDIATION OUTREACH
    # =========================================================================
    @app.post("/api/cases/{case_id}/deficiencies", status_code=201)
    def add_deficiency(case_id: str, payload: CreateDeficiencyRequest) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        if not payload.title.strip():
            raise HTTPException(status_code=400, detail="Deficiency title is required")

        new_item = DeficiencyItem(
            id=f"DEF-{case_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            severity="STANDARD_WARNING" if payload.severity == "STANDARD_WARNING" else "CRITICAL_BLOCKER",
            title=payload.title.strip(),
            description=(payload.description or "").strip() or "Added manually by KYC Senior Analyst.",
            targetEntityOrPerson=(payload.targetEntityOrPerson or "").strip() or kyc_case.entityName,
            targetSubLabel=(payload.targetSubLabel or "").strip() or "Manual Compliance Ticket",
            targetIcon=payload.targetIcon if payload.targetIcon in ("domain", "person", "corporate") else "domain",  # type: ignore[arg-type]
            regulatoryRef=(payload.regulatoryRef or "").strip() or "FCA MLR 2017 / FATF Rec 10",
            regulatoryNote=(payload.regulatoryNote or "").strip() or "Analyst created item",
            status="PENDING_RM_SUBMISSION",
            ageDays=0,
            selectedForOutreach=True,
        )
        kyc_case.deficiencies.insert(0, new_item)
        refresh_case_outreach_draft(kyc_case)
        if kyc_case.status != "Processing":
            kyc_case.status = "Deficiencies Pending"
        store.save_case(kyc_case)
        store.append_audit(
            case_id=case_id,
            category="RULE_TRIGGER",
            category_sub_label="Custom Deficiency Added",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Added custom deficiency item '{new_item.title}' ({new_item.severity}).",
            source_ref="Deficiency_Punch_List",
            source_meta=new_item.regulatoryRef,
            override_justification=new_item.description,
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.patch("/api/cases/{case_id}/deficiencies/{item_id}")
    def update_deficiency(case_id: str, item_id: str, payload: UpdateDeficiencyRequest) -> KycCase:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        item = next((d for d in kyc_case.deficiencies if d.id == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Deficiency item not found")

        if payload.title is not None:
            item.title = payload.title
        if payload.description is not None:
            item.description = payload.description
        if payload.severity is not None:
            item.severity = payload.severity  # type: ignore[assignment]
        if payload.selectedForOutreach is not None:
            item.selectedForOutreach = payload.selectedForOutreach
        if payload.status is not None:
            item.status = payload.status  # type: ignore[assignment]
            if payload.status == "REMEDIATED":
                item.remediatedAt = datetime.now(timezone.utc).isoformat()
                item.remediatedBy = "Marcus Vance"
                item.selectedForOutreach = False

        refresh_case_outreach_draft(kyc_case)
        if not any(d.status != "REMEDIATED" for d in kyc_case.deficiencies) and kyc_case.status == "Deficiencies Pending":
            kyc_case.status = "Ready for Review"
        store.save_case(kyc_case)

        if payload.status == "REMEDIATED":
            store.append_audit(
                case_id=case_id,
                category="ANALYST_OVERRIDE",
                category_sub_label="Deficiency Remediated",
                actor_name="Marcus Vance",
                actor_badge="MV",
                actor_role="KYC Senior Analyst",
                description=f"Marked deficiency '{item.title}' as REMEDIATED.",
                source_ref=item.id,
                source_meta=item.regulatoryRef,
                override_justification="Supporting evidentiary artifact verified.",
            )
        return store.get_case(case_id)  # type: ignore[return-value]

    @app.post("/api/cases/{case_id}/deficiencies/outreach")
    def send_outreach(case_id: str, payload: OutreachRequest) -> KycCase:
        ks = store.get_kill_switch()
        if ks.active:
            raise HTTPException(
                status_code=423,
                detail=f"Outbound outreach frozen by Emergency Kill Switch: {ks.reason or 'Security freeze'}",
            )
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")

        if payload.assignedRmEmail:
            kyc_case.assignedRmEmail = payload.assignedRmEmail
        if payload.escalationCcEmail:
            kyc_case.escalationCcEmail = payload.escalationCcEmail
        if payload.subject:
            kyc_case.outreachDraft.subject = payload.subject
        if payload.body:
            kyc_case.outreachDraft.body = payload.body

        selected = [d for d in kyc_case.deficiencies if d.selectedForOutreach and d.status != "REMEDIATED"]
        for d in selected:
            d.status = "OUTREACH_DISPATCHED"
        kyc_case.outreachDraft.lastSentAt = datetime.now(timezone.utc).isoformat()
        kyc_case.outreachDraft.sentCount += 1
        store.save_case(kyc_case)

        store.append_audit(
            case_id=case_id,
            category="RULE_TRIGGER",
            category_sub_label="Secure Portal Outreach",
            actor_name="Marcus Vance",
            actor_badge="MV",
            actor_role="KYC Senior Analyst",
            description=f"Dispatched encrypted RM Portal remediation notice to {kyc_case.assignedRmEmail} covering {len(selected)} deficiency item(s).",
            metadata_pills=[f"CC: {kyc_case.escalationCcEmail}", f"Dispatch #{kyc_case.outreachDraft.sentCount}"],
            source_ref="Secure_RM_Client_Portal",
            source_meta="TLS 1.3 + Signed Notice",
            override_justification="Mandatory RM outreach workflow executed.",
        )
        return store.get_case(case_id)  # type: ignore[return-value]

    # =========================================================================
    # IMMUTABLE WORM AUDIT TRAIL & 4-EYE SIGN-OFF
    # =========================================================================
    @app.get("/api/cases/{case_id}/audit")
    def get_audit(
        case_id: str,
        category: Optional[str] = None,
        q: Optional[str] = None,
    ) -> dict[str, Any]:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        all_events = store.get_audit_events(case_id)
        counts: dict[str, int] = {
            "ALL": len(all_events),
            "ANALYST_OVERRIDE": 0,
            "REGISTRY_QUERY": 0,
            "UBO_CALCULATION": 0,
            "DOCUMENT_OCR": 0,
            "RULE_TRIGGER": 0,
            "EXECUTIVE_SIGNOFF": 0,
        }
        for ev in all_events:
            counts[ev.category] = counts.get(ev.category, 0) + 1

        events = all_events
        if category and category != "ALL":
            events = [e for e in events if e.category == category]
        if q and q.strip():
            needle = q.strip().lower()
            events = [
                e
                for e in events
                if needle in e.actorName.lower()
                or needle in e.description.lower()
                or needle in e.sourceRef.lower()
                or needle in e.category.lower()
            ]
        return {
            "events": events,
            "counts": counts,
            "merkleRoot": kyc_case.merkleRoot,
            "auditLocked": kyc_case.auditLocked,
            "auditSignedBy": kyc_case.auditSignedBy,
            "auditSignedAt": kyc_case.auditSignedAt,
        }

    @app.post("/api/cases/{case_id}/audit/verify")
    def verify_audit(case_id: str):
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        return verify_chain_integrity(case_id, store.get_audit_events(case_id))

    @app.post("/api/cases/{case_id}/audit/sign-off")
    def sign_off_audit(case_id: str, payload: SignOffRequest) -> dict[str, Any]:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        signer = (payload.officerName or "").strip() or "Elena Rostova (Compliance VP)"
        if payload.action == "REJECT_OVERRIDE":
            kyc_case.auditLocked = False
            kyc_case.status = "Deficiencies Pending"
            store.save_case(kyc_case)
            store.append_audit(
                case_id=case_id,
                category="EXECUTIVE_SIGNOFF",
                category_sub_label="Override Rejected",
                actor_name=signer,
                actor_badge="ER",
                actor_role="Authorized Officer",
                description="Executive officer rejected analyst override and returned case to Deficiencies Pending.",
                source_ref="SEC_17A4_WORM_VAULT",
                source_meta="HSM PKCS#11",
                override_justification=(payload.reason or "").strip() or "Requires secondary evidentiary documentation.",
            )
        else:
            kyc_case.auditLocked = True
            kyc_case.auditSignedBy = signer
            kyc_case.auditSignedAt = datetime.now(timezone.utc).isoformat()
            if not any(d.status != "REMEDIATED" for d in kyc_case.deficiencies):
                kyc_case.status = "Verified / Cleared"
            store.save_case(kyc_case)
            store.append_audit(
                case_id=case_id,
                category="EXECUTIVE_SIGNOFF",
                category_sub_label="WORM Audit Locked",
                actor_name=signer,
                actor_badge="ER",
                actor_role="Compliance VP / Authorized Officer",
                description=f"Executed cryptographic sign-off and locked immutable audit trail ({case_id}).",
                metadata_pills=["FinCEN CDD / EU 5AMLD", "SEC 17a-4 WORM"],
                source_ref=f"EXP-{case_id}-NORTHGATE-LOG",
                source_meta="HSM PKCS#11 Attestation",
                override_justification=(payload.reason or "").strip() or "All lineages, source hashes, and analyst rationales attested.",
            )
        return {"case": store.get_case(case_id), "auditEvents": store.get_audit_events(case_id)}

    @app.get("/api/cases/{case_id}/audit/export")
    def export_audit(case_id: str, format: str = Query("json")) -> Response:
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        events = store.get_audit_events(case_id)
        if format == "csv":
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(
                ["SEQUENCE", "TIMESTAMP_UTC", "DATE_UTC", "CATEGORY", "ACTOR", "DESCRIPTION", "SOURCE_REF", "PREVIOUS_HASH", "HASH"]
            )
            for e in events:
                writer.writerow(
                    [e.sequence, e.timestampUtc, e.dateUtc, e.category, e.actorName, e.description, e.sourceRef, e.previousHash, e.hash]
                )
            return Response(
                content=buf.getvalue(),
                media_type="text/csv; charset=utf-8",
                headers={"Content-Disposition": f'attachment; filename="{kyc_case.id}-audit-trail.csv"'},
            )
        verification = verify_chain_integrity(case_id, events)
        return Response(
            content=json.dumps(
                {
                    "exportToken": f"EXP-{kyc_case.id}-NORTHGATE-LOG",
                    "regulatoryStandard": "SEC 17a-4 / FINRA / FinCEN CDD / EU 5AMLD",
                    "verification": verification.model_dump(),
                    "events": [e.model_dump() for e in events],
                },
                indent=2,
            ),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{kyc_case.id}-audit-trail.json"'},
        )

    # =========================================================================
    # GOVERNANCE: POLICY, KILL SWITCH, AI GATEWAY, GATED MCP
    # =========================================================================
    @app.get("/api/policy")
    def get_policy():
        return store.get_policy()

    @app.put("/api/policy")
    def update_policy(patch: dict[str, Any]):
        updated = store.update_policy({**patch, "updatedBy": "Marcus Vance (Senior Analyst)"})
        for c in store.list_cases().cases:
            c.ownershipNodes = recalculate_ownership_tree(c.ownershipNodes, updated.uboThresholdPct)
            store.save_case(c)
        return updated

    @app.post("/api/system/reset")
    def reset_system():
        store.reset()
        res = store.list_cases()
        return {"status": "reset", "cases": res.cases, "metrics": res.metrics}

    @app.get("/api/governance/kill-switch")
    def get_kill_switch():
        return store.get_kill_switch()

    @app.post("/api/governance/kill-switch")
    def set_kill_switch(payload: KillSwitchRequest):
        from app.models.schemas import KillSwitchState

        next_ks = store.set_kill_switch(
            KillSwitchState(
                active=payload.active,
                reason=(payload.reason or "").strip() or "Emergency compliance circuit breaker engaged"
                if payload.active
                else None,
                activatedBy="Marcus Vance (Senior Analyst)" if payload.active else None,
                activatedAt=datetime.now(timezone.utc).isoformat() if payload.active else None,
            )
        )
        cases = store.list_cases().cases
        if next_ks.active and cases:
            store.append_audit(
                case_id=cases[0].id,
                category="RULE_TRIGGER",
                category_sub_label="Emergency Kill Switch",
                actor_name="Marcus Vance",
                actor_badge="KS",
                actor_role="Governance Officer",
                description="Activated Emergency Kill Switch — worker execution and outbound communications frozen.",
                source_ref="governance/kill-switch",
                source_meta=next_ks.reason or "Circuit Breaker",
                override_justification=next_ks.reason or "Emergency governance halt.",
            )
        return next_ks

    @app.get("/api/governance/ai-gateway")
    def get_ai_gateway():
        return store.get_ai_gateway()

    @app.post("/api/governance/ai-gateway/toggle-outage")
    def toggle_ai_outage(payload: ToggleOutageRequest):
        return store.set_ai_gateway(
            status="CIRCUIT_BREAKER_OPEN" if payload.outage else "OPERATIONAL",
            lastSimulatedOutageAt=datetime.now(timezone.utc).isoformat()
            if payload.outage
            else store.get_ai_gateway().lastSimulatedOutageAt,
        )

    @app.post("/api/governance/ai-gateway/cases/{case_id}/assess")
    def assess_case_ai(case_id: str):
        kyc_case = store.get_case(case_id)
        if not kyc_case:
            raise HTTPException(status_code=404, detail="Case not found")
        return run_ai_triage_assessment(kyc_case, store.get_ai_gateway())

    @app.get("/api/mcp/tools")
    def list_mcp_tools():
        return {"tools": MCP_TOOLS}

    @app.post("/api/mcp/invoke")
    def invoke_mcp(payload: McpInvokeRequest) -> Response:
        res = invoke_gated_mcp_tool(
            store, payload.tool, payload.caseId, analyst_approved=payload.analystApproved
        )
        return Response(
            content=res.model_dump_json(),
            status_code=200 if res.allowed else 403,
            media_type="application/json",
        )

    return app


app = create_app()
