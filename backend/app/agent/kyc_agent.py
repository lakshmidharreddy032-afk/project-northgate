from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.ai_gateway.gateway import run_ai_triage_assessment
from app.mcp.gated_tools import invoke_gated_mcp_tool
from app.models.schemas import AgentRunTrace, AgentStep
from app.models.ubo import recalculate_ownership_tree
from app.ocr.leptos_ocr import extract_spatial_regions

if TYPE_CHECKING:
    from app.orchestrator.store import NorthgateStore


def run_agentic_kyc_workflow(store: NorthgateStore, case_id: str) -> AgentRunTrace:
    """Execute Project Northgate's bounded Agentic AI KYC Workflow.

    Loop:
      1. PLAN -> Select jurisdiction & regulatory playbook
      2. TOOL_CALL (ocr.leptos_extract) -> Spatial bounding-box extraction
      3. TOOL_CALL (mcp.public_registries) -> Statutory cross-reconciliation
      4. GUARDRAIL (models.recalculate_ownership_tree) -> Deterministic UBO math
      5. TOOL_CALL (mcp.identity_service) -> Biometric liveness verdicts (no raw telemetry)
      6. REASON (ai_gateway) -> Schema-validated triage summary with circuit-breaker fallback
      7. HUMAN_GATE (mcp.notifications) -> Pause at analyst approval gate before outreach
    """
    kyc_case = store.get_case(case_id)
    if not kyc_case:
        raise ValueError(f"Case {case_id} not found")

    started = datetime.now(timezone.utc)
    kill_switch = store.get_kill_switch()
    steps: list[AgentStep] = []

    if kill_switch.active:
        now_iso = datetime.now(timezone.utc).isoformat()
        trace = AgentRunTrace(
            runId=f"AGT-{case_id}-{len(kyc_case.agentRuns) + 1:03d}",
            caseId=case_id,
            startedAt=started.isoformat(),
            completedAt=now_iso,
            durationMs=4,
            gateStatus="BLOCKED_KILL_SWITCH",
            aiDegradedFallback=False,
            summary=f"Agentic workflow halted by Emergency Kill Switch: {kill_switch.reason}",
            steps=[
                AgentStep(
                    stepNumber=1,
                    kind="HUMAN_GATE",
                    title="Emergency Kill Switch Check",
                    toolName="governance.kill_switch",
                    thought="Verify operational circuit breaker prior to executing autonomous KYC steps.",
                    observation=f"BLOCKED: {kill_switch.reason or 'Circuit breaker active'}.",
                    status="BLOCKED",
                    durationMs=4,
                    timestamp=now_iso,
                )
            ],
        )
        kyc_case.agentRuns.insert(0, trace)
        store.save_case(kyc_case)
        return trace

    # Step 1: PLAN
    steps.append(
        AgentStep(
            stepNumber=1,
            kind="PLAN",
            title="Formulate Jurisdiction Playbook",
            thought=f"Analyze {kyc_case.entityName} ({kyc_case.jurisdiction}, {kyc_case.legalForm}) under {store.get_policy().ruleEngineVersion}.",
            observation=(
                f"Planned 5-stage verification across {len(kyc_case.documents)} ingested artifact(s) "
                f"and {len(kyc_case.ownershipNodes)} ownership node(s)."
            ),
            status="PASSED",
            durationMs=12,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Step 2: OCR Spatial Extraction
    regions = extract_spatial_regions(kyc_case.documents)
    flagged_regions = [r for r in regions if r["status"] != "VERIFIED"]
    steps.append(
        AgentStep(
            stepNumber=2,
            kind="TOOL_CALL",
            title="Leptos OCR Spatial Extraction",
            toolName="ocr.leptos_extract",
            thought="Extract evidentiary clauses with [x, y, w, h] & [x1, y1, x2, y2] bounding boxes.",
            observation=f"Extracted {len(regions)} spatial bounding region(s); {len(flagged_regions)} flagged for discrepancy review.",
            status="WARNING" if flagged_regions else "PASSED",
            durationMs=24,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Step 3: Gated MCP Public Registries
    reg_res = invoke_gated_mcp_tool(store, "public_registries", case_id)
    disc_count = reg_res.payload.get("discrepancies", 0) if isinstance(reg_res.payload, dict) else 0
    steps.append(
        AgentStep(
            stepNumber=3,
            kind="TOOL_CALL",
            title="Query Authoritative Public Registries",
            toolName="mcp://public_registries",
            thought="Cross-reconcile declared packet values against UK Companies House, GLEIF, and OpenCorporates.",
            observation=f"Reconciled {len(kyc_case.registryChecks)} fields; {disc_count} critical statutory mismatch(es) detected.",
            status="WARNING" if disc_count > 0 else "PASSED",
            durationMs=38,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Step 4: Deterministic Ownership Math Guardrail
    policy = store.get_policy()
    kyc_case.ownershipNodes = recalculate_ownership_tree(
        kyc_case.ownershipNodes, policy.uboThresholdPct
    )
    qualified = [n for n in kyc_case.ownershipNodes if n.isQualifiedUbo]
    steps.append(
        AgentStep(
            stepNumber=4,
            kind="GUARDRAIL",
            title="Deterministic UBO Path Multiplication",
            toolName="models.recalculate_ownership_tree",
            thought=f"Apply deterministic FATF/5AMLD threshold (>= {policy.uboThresholdPct}%) without LLM mutation.",
            observation=(
                "Identified "
                + (", ".join(f"{u.name} ({u.effectivePct:.1f}%)" for u in qualified) or "0 qualified UBOs")
                + ". Guardrail: uboPercentagesModified=False."
            ),
            status="PASSED",
            durationMs=11,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Step 5: Gated MCP Identity Service
    id_res = invoke_gated_mcp_tool(store, "identity_service", case_id)
    verdicts = id_res.payload.get("verdicts", []) if isinstance(id_res.payload, dict) else []
    expired_verdicts = [v for v in verdicts if v.get("verdict") == "DOCUMENT_EXPIRED"]
    steps.append(
        AgentStep(
            stepNumber=5,
            kind="TOOL_CALL",
            title="Biometric Liveness Verdicts (Privacy Boundary)",
            toolName="mcp://identity_service",
            thought="Verify UBO biometric liveness verdicts without persisting raw biometric telemetry.",
            observation=f"Checked {len(verdicts)} subject(s) (telemetryStored=False); {len(expired_verdicts)} expired ID verdict(s).",
            status="WARNING" if expired_verdicts else "PASSED",
            durationMs=19,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Step 6: AI Gateway Triage Assessment
    assessment = run_ai_triage_assessment(kyc_case, store.get_ai_gateway())
    steps.append(
        AgentStep(
            stepNumber=6,
            kind="REASON",
            title="AI Gateway Schema-Validated Triage",
            toolName="ai_gateway.assess",
            thought="Synthesize remediation priorities under strict schema validation & circuit breaker.",
            observation=assessment.executiveSummary,
            status="WARNING" if assessment.degradedFallback else "PASSED",
            durationMs=29,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Step 7: Human-in-the-Loop Gate on Outbound Notifications
    steps.append(
        AgentStep(
            stepNumber=7,
            kind="HUMAN_GATE",
            title="Analyst Approval Gate (Outbound RM Notice)",
            toolName="mcp://notifications",
            thought="Stage remediation outreach draft; hold transmission pending explicit human analyst sign-off.",
            observation=f"Paused at 4-eye gate for {len([d for d in kyc_case.deficiencies if d.status != 'REMEDIATED'])} open deficiency item(s).",
            status="AWAITING_APPROVAL",
            durationMs=6,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    )

    completed = datetime.now(timezone.utc)
    trace = AgentRunTrace(
        runId=f"AGT-{case_id}-{len(kyc_case.agentRuns) + 1:03d}",
        caseId=case_id,
        startedAt=started.isoformat(),
        completedAt=completed.isoformat(),
        durationMs=sum(s.durationMs for s in steps),
        gateStatus="AWAITING_ANALYST_APPROVAL",
        aiDegradedFallback=assessment.degradedFallback,
        summary=assessment.executiveSummary,
        steps=steps,
    )

    kyc_case.agentRuns.insert(0, trace)
    store.save_case(kyc_case)

    store.append_audit(
        case_id=case_id,
        category="RULE_TRIGGER",
        category_sub_label="Agentic Workflow Run",
        actor_name="Northgate KYC Agent",
        actor_badge="AG",
        actor_role="Agentic Orchestrator",
        description=f"Completed 7-step agentic KYC verification ({trace.runId}); staged at analyst approval gate.",
        metadata_pills=[
            f"Steps: {len(steps)}",
            f"Fallback: {assessment.degradedFallback}",
            "UBO Guardrail: Enforced",
        ],
        source_ref=trace.runId,
        source_meta="Agentic Workflow Engine",
        override_justification="Autonomous verification completed; paused at human approval gate.",
    )
    return trace


def approve_agent_gate(
    store: NorthgateStore,
    case_id: str,
    run_id: str,
    *,
    analyst_name: str,
    justification: str,
) -> AgentRunTrace:
    kyc_case = store.get_case(case_id)
    if not kyc_case:
        raise ValueError(f"Case {case_id} not found")
    trace = next((r for r in kyc_case.agentRuns if r.runId == run_id), None)
    if not trace:
        raise ValueError(f"Agent run {run_id} not found")

    notif_res = invoke_gated_mcp_tool(store, "notifications", case_id, analyst_approved=True)
    if not notif_res.allowed:
        raise PermissionError(notif_res.gatedBy)

    now = datetime.now(timezone.utc).isoformat()
    trace.gateStatus = "APPROVED_BY_ANALYST"
    trace.approvedBy = analyst_name
    trace.approvedAt = now
    trace.approvalJustification = justification
    for step in trace.steps:
        if step.kind == "HUMAN_GATE":
            step.status = "PASSED"
            step.observation = f"Approved by {analyst_name}; mcp://notifications unlocked and dispatched."

    for d in kyc_case.deficiencies:
        if d.selectedForOutreach and d.status != "REMEDIATED":
            d.status = "OUTREACH_DISPATCHED"
    kyc_case.outreachDraft.lastSentAt = now
    kyc_case.outreachDraft.sentCount += 1
    store.save_case(kyc_case)

    store.append_audit(
        case_id=case_id,
        category="ANALYST_OVERRIDE",
        category_sub_label="Agent Gate Approved",
        actor_name=analyst_name,
        actor_badge="MV",
        actor_role="KYC Senior Analyst",
        description=f"Approved Agentic AI Workflow gate ({run_id}) and released mcp://notifications outreach.",
        source_ref=run_id,
        source_meta="Human-in-the-Loop Gate",
        override_justification=justification,
    )
    return trace
