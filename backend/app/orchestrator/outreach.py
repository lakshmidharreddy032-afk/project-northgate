from __future__ import annotations

from app.models.schemas import DeficiencyItem, KycCase


def build_outreach_draft(
    case_id: str,
    entity_name: str,
    assigned_rm_name: str,
    sla_deadline_label: str,
    deficiencies: list[DeficiencyItem],
) -> tuple[str, str]:
    active_items = [
        d for d in deficiencies if d.selectedForOutreach and d.status != "REMEDIATED"
    ]
    first_name = assigned_rm_name.split(" ")[0] if assigned_rm_name else "Team"
    subject = f"ACTION REQUIRED: Onboarding Deficiencies for {entity_name} ({case_id})"

    if not active_items:
        body = (
            f"Dear {first_name},\n\n"
            f"All previously flagged deficiencies for {entity_name} ({case_id}) have been remediated "
            "or deselected from outreach.\n\nRegards,\nProject Northgate Compliance Desk"
        )
        return subject, body

    lines = []
    for idx, item in enumerate(active_items, start=1):
        tag = "[CRITICAL]" if item.severity == "CRITICAL_BLOCKER" else "[STANDARD]"
        lines.append(
            f"{idx}. {tag} {item.title}: {item.description} "
            f"(Ref: {item.regulatoryRef} — {item.regulatoryNote})."
        )

    body = "\n".join(
        [
            f"Dear {first_name},",
            "",
            (
                f"The institutional KYC review for {entity_name} ({case_id}) is currently pending "
                f"resolution of {len(active_items)} item(s) identified during automated registry "
                "reconciliation and evidentiary extraction:"
            ),
            "",
            *lines,
            "",
            (
                f"Please upload certified documentation via the Secure RM Client Portal prior to "
                f"{sla_deadline_label} to prevent onboarding pipeline freeze."
            ),
            "",
            "Respectfully,",
            "Marcus Vance — KYC Senior Analyst",
            "Project Northgate • FedRAMP High Compliance Desk",
        ]
    )
    return subject, body


def refresh_case_outreach_draft(kyc_case: KycCase) -> None:
    subject, body = build_outreach_draft(
        kyc_case.id,
        kyc_case.entityName,
        kyc_case.assignedRmName,
        kyc_case.slaDeadlineLabel,
        kyc_case.deficiencies,
    )
    kyc_case.outreachDraft.subject = subject
    kyc_case.outreachDraft.body = body
