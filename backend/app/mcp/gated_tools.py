from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.models.schemas import BiometricLivenessVerdict, McpToolName, McpToolResult

if TYPE_CHECKING:
    from app.orchestrator.store import NorthgateStore

MCP_TOOLS: list[dict[str, str]] = [
    {
        "name": "identity_service",
        "description": (
            "Biometric liveness check verdicts for Qualified UBOs and Signatories "
            "(verdicts only; never stores raw biometric telemetry)."
        ),
        "gateRule": "Privacy-preserving verdict-only boundary",
    },
    {
        "name": "case_system",
        "description": "Read/stage case status, multi-tier cap tables, and deficiency punch lists.",
        "gateRule": "Read/staging non-invasive sidecar",
    },
    {
        "name": "notifications",
        "description": "Outbound applicant and RM remediation communications using approved templates.",
        "gateRule": "Blocked unless explicit analyst approval gate is satisfied & Kill Switch is inactive",
    },
    {
        "name": "public_registries",
        "description": "Public corporate registries covering UK Companies House, GLEIF, and OpenCorporates.",
        "gateRule": "Circuit-breaker gated on emergency Kill Switch",
    },
]


def invoke_gated_mcp_tool(
    store: NorthgateStore,
    tool: McpToolName,
    case_id: str,
    *,
    analyst_approved: bool = False,
) -> McpToolResult:
    kill_switch = store.get_kill_switch()
    kyc_case = store.get_case(case_id)
    now = datetime.now(timezone.utc).isoformat()

    if kill_switch.active and tool != "case_system":
        store.append_audit(
            case_id=case_id,
            category="RULE_TRIGGER",
            category_sub_label="Kill Switch Blocked MCP",
            actor_name="MCP Gate",
            actor_badge="MG",
            actor_role="Governance Enforcer",
            description=f"Blocked invocation of gated MCP tool '{tool}' because Emergency Kill Switch is ACTIVE.",
            source_ref=f"mcp://{tool}",
            source_meta=kill_switch.reason or "Circuit Breaker Active",
            override_justification="Automated emergency circuit breaker enforcement.",
        )
        return McpToolResult(
            tool=tool,
            allowed=False,
            gatedBy=f"EMERGENCY_KILL_SWITCH: {kill_switch.reason or 'System Frozen'}",
            timestamp=now,
            payload={"blocked": True},
        )

    if not kyc_case:
        return McpToolResult(
            tool=tool,
            allowed=False,
            gatedBy="CASE_NOT_FOUND",
            timestamp=now,
            payload={"error": f"Case {case_id} not found"},
        )

    if tool == "identity_service":
        subjects = [
            n
            for n in kyc_case.ownershipNodes
            if n.isQualifiedUbo or n.kind == "DIRECT_SHAREHOLDER"
        ]
        verdicts = [
            BiometricLivenessVerdict(
                subjectName=node.name,
                role=(
                    f"Qualified UBO ({node.effectivePct:.1f}%)"
                    if node.isQualifiedUbo
                    else "Signatory / Shareholder"
                ),
                verdict=(
                    "DOCUMENT_EXPIRED"
                    if node.determinationStatus == "DISCREPANCY_PENDING"
                    else "LIVENESS_PASS"
                ),
                checkedAt=now,
                telemetryStored=False,
            ).model_dump()
            for node in subjects
        ]

        store.append_audit(
            case_id=case_id,
            category="RULE_TRIGGER",
            category_sub_label="MCP identity_service",
            actor_name="MCP Gate",
            actor_badge="ID",
            actor_role="Identity Service Tool",
            description=f"Queried biometric liveness verdicts for {len(verdicts)} subjects (telemetryStored=False).",
            source_ref="mcp://identity_service",
            source_meta="Verdict-Only Boundary",
            override_justification="Automated UBO biometric liveness verification.",
        )
        return McpToolResult(
            tool=tool,
            allowed=True,
            gatedBy="VERDICT_ONLY_PRIVACY_BOUNDARY",
            timestamp=now,
            payload={"verdicts": verdicts},
        )

    if tool == "notifications":
        if not analyst_approved:
            store.append_audit(
                case_id=case_id,
                category="RULE_TRIGGER",
                category_sub_label="Approval Gate Blocked",
                actor_name="MCP Gate",
                actor_badge="NG",
                actor_role="Notification Gate",
                description=f"Blocked unapproved outbound notification on {case_id}; explicit analyst sign-off required.",
                source_ref="mcp://notifications",
                source_meta="Human-in-the-Loop Gate",
                override_justification="Strict approval gate prevented autonomous send.",
            )
            return McpToolResult(
                tool=tool,
                allowed=False,
                gatedBy="APPROVAL_GATE_REQUIRED",
                timestamp=now,
                payload={"error": "Outbound notifications require explicit analyst sign-off."},
            )
        return McpToolResult(
            tool=tool,
            allowed=True,
            gatedBy="ANALYST_SIGNED_OFF",
            timestamp=now,
            payload={
                "recipient": kyc_case.assignedRmEmail,
                "subject": kyc_case.outreachDraft.subject,
                "templateApproved": True,
            },
        )

    if tool == "public_registries":
        return McpToolResult(
            tool=tool,
            allowed=True,
            gatedBy="PUBLIC_REGISTRY_BRIDGE",
            timestamp=now,
            payload={
                "sources": ["UK Companies House", "GLEIF", "OpenCorporates"],
                "latencyMs": kyc_case.registryLatencyMs or 142,
                "fieldsChecked": len(kyc_case.registryChecks),
                "discrepancies": sum(
                    1 for r in kyc_case.registryChecks if r.status == "CRITICAL_MISMATCH"
                ),
            },
        )

    return McpToolResult(
        tool=tool,
        allowed=True,
        gatedBy="READ_STAGING_SIDECAR",
        timestamp=now,
        payload={
            "caseId": kyc_case.id,
            "entityName": kyc_case.entityName,
            "status": kyc_case.status,
            "openDeficiencies": sum(
                1 for d in kyc_case.deficiencies if d.status != "REMEDIATED"
            ),
            "qualifiedUbos": [
                {"name": u.name, "effectivePct": u.effectivePct}
                for u in kyc_case.ownershipNodes
                if u.isQualifiedUbo
            ],
        },
    )
