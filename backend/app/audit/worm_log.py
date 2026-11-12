from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import AuditEvent, AuditEventCategory, AuditVerificationResult

GENESIS_HASH = "0x7F41A90000000000000000000000000000000000000000000000000000004B90"


def compute_file_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def compute_audit_hash(event: AuditEvent | dict) -> str:
    data = event.model_dump() if isinstance(event, AuditEvent) else dict(event)
    canonical = json.dumps(
        {
            "sequence": data["sequence"],
            "caseId": data["caseId"],
            "timestampUtc": data["timestampUtc"],
            "dateUtc": data["dateUtc"],
            "category": data["category"],
            "categorySubLabel": data["categorySubLabel"],
            "actorName": data["actorName"],
            "actorBadge": data["actorBadge"],
            "description": data["description"],
            "sourceRef": data["sourceRef"],
            "overrideJustification": data["overrideJustification"],
            "previousHash": data["previousHash"],
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return "0x" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def create_chained_audit_event(
    existing_case_events: list[AuditEvent],
    *,
    case_id: str,
    category: AuditEventCategory,
    category_sub_label: str,
    actor_name: str,
    actor_badge: str,
    actor_role: str,
    description: str,
    source_ref: str,
    source_meta: str,
    override_justification: str,
    metadata_pills: Optional[list[str]] = None,
    timestamp: Optional[datetime] = None,
) -> AuditEvent:
    max_seq = max((e.sequence for e in existing_case_events), default=0)
    latest = next((e for e in existing_case_events if e.sequence == max_seq), None)
    previous_hash = latest.hash if latest else GENESIS_HASH
    now = timestamp or datetime.now(timezone.utc)
    iso = now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    date_str, time_str = iso.split("T")
    sequence = max_seq + 1

    payload = {
        "id": f"AUD-{case_id}-{sequence:04d}",
        "sequence": sequence,
        "caseId": case_id,
        "timestampUtc": time_str,
        "dateUtc": date_str,
        "category": category,
        "categorySubLabel": category_sub_label,
        "actorName": actor_name,
        "actorBadge": actor_badge,
        "actorRole": actor_role,
        "description": description,
        "metadataPills": metadata_pills or [],
        "sourceRef": source_ref,
        "sourceMeta": source_meta,
        "overrideJustification": override_justification,
        "previousHash": previous_hash,
    }
    payload["hash"] = compute_audit_hash(payload)
    return AuditEvent(**payload)


def verify_chain_integrity(case_id: str, events: list[AuditEvent]) -> AuditVerificationResult:
    ordered = sorted(events, key=lambda e: e.sequence)
    expected_prev = GENESIS_HASH
    broken_at: Optional[int] = None

    for event in ordered:
        if event.previousHash != expected_prev:
            broken_at = event.sequence
            break
        if event.hash != compute_audit_hash(event):
            broken_at = event.sequence
            break
        expected_prev = event.hash

    return AuditVerificationResult(
        caseId=case_id,
        valid=broken_at is None,
        checkedCount=len(ordered),
        brokenAtSequence=broken_at,
        merkleRoot=ordered[-1].hash if ordered else GENESIS_HASH,
        verifiedAt=datetime.now(timezone.utc).isoformat(),
    )
