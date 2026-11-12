from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.audit.worm_log import create_chained_audit_event
from app.fixtures.seed_data import DatabaseState, create_seed_database
from app.models.schemas import (
    AiGatewayState,
    AuditEvent,
    AuditEventCategory,
    CasesListResponse,
    KillSwitchState,
    KycCase,
    PolicySettings,
    QueueMetrics,
)


class NorthgateStore:
    def __init__(self, db_path: Path | str | None = None) -> None:
        default_path = Path(__file__).resolve().parents[2] / "data" / "db.json"
        self.db_path = Path(db_path) if db_path else default_path
        self.state: DatabaseState = self._load_or_seed()

    def _load_or_seed(self) -> DatabaseState:
        if self.db_path.exists():
            try:
                raw = self.db_path.read_text(encoding="utf-8")
                parsed = json.loads(raw)
                if parsed.get("schemaVersion") == 2:
                    return DatabaseState.model_validate(parsed)
            except Exception:
                pass
        seed = create_seed_database()
        self._persist(seed)
        return seed

    def _persist(self, next_state: DatabaseState | None = None) -> None:
        state = next_state or self.state
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.db_path.with_suffix(".tmp")
        tmp.write_text(state.model_dump_json(indent=2), encoding="utf-8")
        tmp.replace(self.db_path)

    def reset(self) -> DatabaseState:
        self.state = create_seed_database()
        self._persist()
        return self.state

    def get_policy(self) -> PolicySettings:
        return self.state.policy

    def update_policy(self, patch: dict) -> PolicySettings:
        current = self.state.policy.model_dump()
        for k, v in patch.items():
            if k in current and v is not None:
                current[k] = v
        current["updatedAt"] = datetime.now(timezone.utc).isoformat()
        self.state.policy = PolicySettings(**current)
        self._persist()
        return self.state.policy

    def get_kill_switch(self) -> KillSwitchState:
        return self.state.killSwitch

    def set_kill_switch(self, next_state: KillSwitchState) -> KillSwitchState:
        self.state.killSwitch = next_state
        self._persist()
        return self.state.killSwitch

    def get_ai_gateway(self) -> AiGatewayState:
        return self.state.aiGateway

    def set_ai_gateway(self, **patch: object) -> AiGatewayState:
        current = self.state.aiGateway.model_dump()
        for k, v in patch.items():
            if k in current and v is not None:
                current[k] = v
        self.state.aiGateway = AiGatewayState(**current)
        self._persist()
        return self.state.aiGateway

    def list_cases(
        self,
        *,
        status: Optional[str] = None,
        jurisdiction: Optional[str] = None,
        q: Optional[str] = None,
    ) -> CasesListResponse:
        all_cases = self.state.cases
        status_counts: dict[str, int] = {
            "all": len(all_cases),
            "Ready for Review": 0,
            "Processing": 0,
            "Deficiencies Pending": 0,
            "Verified / Cleared": 0,
            "Closed": 0,
        }

        discrepancy_cases = 0
        total_cycle = 0
        sla_passed = 0

        for c in all_cases:
            status_counts[c.status] = status_counts.get(c.status, 0) + 1
            total_cycle += c.cycleTimeSec
            has_disc = any(d.status != "REMEDIATED" for d in c.deficiencies) or any(
                r.status == "CRITICAL_MISMATCH" for r in c.registryChecks
            )
            if has_disc:
                discrepancy_cases += 1
            if c.cycleTimeSec <= self.state.policy.targetIntakeCycleSec:
                sla_passed += 1

        n = len(all_cases)
        avg_cycle = round(total_cycle / n) if n else 0
        disc_rate = round((discrepancy_cases / n) * 100.0, 1) if n else 0.0
        sla_pct = round((sla_passed / n) * 100.0, 1) if n else 100.0

        filtered = list(all_cases)
        if status and status != "all":
            filtered = [c for c in filtered if c.status == status]
        if jurisdiction and jurisdiction != "all":
            filtered = [
                c for c in filtered if jurisdiction.lower() in c.jurisdiction.lower()
            ]
        if q and q.strip():
            needle = q.strip().lower()
            filtered = [
                c
                for c in filtered
                if needle in c.id.lower()
                or needle in c.entityName.lower()
                or needle in c.jurisdiction.lower()
                or needle in c.identifierValue.lower()
                or any(needle in node.name.lower() for node in c.ownershipNodes)
            ]

        metrics = QueueMetrics(
            activeQueueCount=n,
            deltaFromLastShift=3,
            avgIntakeCycleSec=avg_cycle,
            targetCycleSec=self.state.policy.targetIntakeCycleSec,
            discrepancyRatePct=disc_rate,
            flaggedUboPct=2.1,
            slaCompliancePct=sla_pct,
            slaPassedCount=sla_passed,
            slaTotalCount=n,
            statusCounts=status_counts,
        )
        return CasesListResponse(cases=filtered, metrics=metrics)

    def get_case(self, case_id: str) -> Optional[KycCase]:
        return next((c for c in self.state.cases if c.id == case_id), None)

    def add_case(self, kyc_case: KycCase) -> KycCase:
        self.state.cases.insert(0, kyc_case)
        self._persist()
        return kyc_case

    def save_case(self, kyc_case: KycCase) -> KycCase:
        kyc_case.updatedAt = datetime.now(timezone.utc).isoformat()
        for idx, existing in enumerate(self.state.cases):
            if existing.id == kyc_case.id:
                self.state.cases[idx] = kyc_case
                break
        else:
            self.state.cases.insert(0, kyc_case)
        self._persist()
        return kyc_case

    def get_audit_events(self, case_id: str) -> list[AuditEvent]:
        return sorted(
            [e for e in self.state.auditEvents if e.caseId == case_id],
            key=lambda e: e.sequence,
            reverse=True,
        )

    def append_audit(
        self,
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
    ) -> AuditEvent:
        existing = [e for e in self.state.auditEvents if e.caseId == case_id]
        created = create_chained_audit_event(
            existing,
            case_id=case_id,
            category=category,
            category_sub_label=category_sub_label,
            actor_name=actor_name,
            actor_badge=actor_badge,
            actor_role=actor_role,
            description=description,
            source_ref=source_ref,
            source_meta=source_meta,
            override_justification=override_justification,
            metadata_pills=metadata_pills,
        )
        self.state.auditEvents.append(created)
        kyc_case = self.get_case(case_id)
        if kyc_case:
            kyc_case.merkleRoot = created.hash
            kyc_case.updatedAt = datetime.now(timezone.utc).isoformat()
        self._persist()
        return created
