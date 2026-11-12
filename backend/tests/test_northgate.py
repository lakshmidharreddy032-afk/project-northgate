from __future__ import annotations

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.audit.worm_log import verify_chain_integrity
from app.main import create_app
from app.models.schemas import OwnershipNode
from app.models.ubo import compute_direct_ownership_sum, recalculate_ownership_tree
from app.ocr.leptos_ocr import extract_spatial_regions


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    app = create_app(
        db_path=tmp_path / "db.json",
        uploads_dir=tmp_path / "uploads",
    )
    return TestClient(app)


def test_health_endpoints(client: TestClient) -> None:
    r1 = client.get("/health")
    r2 = client.get("/api/health")
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["status"] == "ok"


def test_openapi_swagger_docs_available(client: TestClient) -> None:
    res = client.get("/openapi.json")
    assert res.status_code == 200
    assert "Project Northgate" in res.json()["info"]["title"]


def test_recursive_ubo_math_and_threshold() -> None:
    nodes = [
        OwnershipNode(id="root", parentId=None, tier=0, kind="TARGET", name="Target", legalForm="Ltd", jurisdiction="GB", registrationOrCitizenship="GB", directPct=100, effectivePct=100, formulaLabel="", isQualifiedUbo=False, holdingRoute="", screeningResult="", pscStatus="", determinationStatus="CONFIRMED", analystNotes=""),
        OwnershipNode(id="hold", parentId="root", tier=1, kind="HOLDING_CO", name="HoldCo", legalForm="Corp", jurisdiction="KY", registrationOrCitizenship="KY", directPct=60, effectivePct=0, formulaLabel="", isQualifiedUbo=False, holdingRoute="", screeningResult="", pscStatus="", determinationStatus="INTERMEDIATE_TIER", analystNotes=""),
        OwnershipNode(id="alice", parentId="hold", tier=2, kind="NATURAL_PERSON", name="Alice", legalForm="Natural Person", jurisdiction="GB", registrationOrCitizenship="GB", directPct=50, effectivePct=0, formulaLabel="", isQualifiedUbo=False, holdingRoute="", screeningResult="", pscStatus="", determinationStatus="CONFIRMED", analystNotes=""),
        OwnershipNode(id="bob", parentId="hold", tier=2, kind="NATURAL_PERSON", name="Bob", legalForm="Natural Person", jurisdiction="GB", registrationOrCitizenship="GB", directPct=30, effectivePct=0, formulaLabel="", isQualifiedUbo=False, holdingRoute="", screeningResult="", pscStatus="", determinationStatus="CONFIRMED", analystNotes=""),
        OwnershipNode(id="min", parentId="root", tier=1, kind="DIRECT_SHAREHOLDER", name="Minority", legalForm="Natural Person", jurisdiction="GB", registrationOrCitizenship="GB", directPct=40, effectivePct=0, formulaLabel="", isQualifiedUbo=False, holdingRoute="", screeningResult="", pscStatus="", determinationStatus="MINORITY_EXEMPT", analystNotes=""),
    ]
    calc = recalculate_ownership_tree(nodes, 25.0)
    by_id = {n.id: n for n in calc}
    assert by_id["alice"].effectivePct == 30.0
    assert by_id["alice"].isQualifiedUbo is True
    assert by_id["bob"].effectivePct == 18.0
    assert by_id["bob"].isQualifiedUbo is False
    assert compute_direct_ownership_sum(calc) == 100.0


def test_list_and_filter_seeded_cases(client: TestClient) -> None:
    res = client.get("/api/cases")
    assert res.status_code == 200
    data = res.json()
    assert data["metrics"]["activeQueueCount"] == 6
    assert data["cases"][0]["id"] == "CASE-2024-8841"

    filtered = client.get("/api/cases?q=Harbor")
    assert len(filtered.json()["cases"]) == 1


def test_export_intake_ledger_csv(client: TestClient) -> None:
    res = client.get("/api/cases/export-ledger")
    assert res.status_code == 200
    assert "CASE-2024-8841" in res.text


def test_upload_bundle_and_dag_advance(client: TestClient) -> None:
    res = client.post(
        "/api/cases/upload-bundle",
        data={
            "entityName": "Nordic Quantum Freight AB",
            "jurisdiction": "Sweden",
            "legalForm": "AB",
            "identifierValue": "559102-8841",
        },
        files={"files": ("Articles_SE.pdf", b"%PDF-1.4 sample corporate filing", "application/pdf")},
    )
    assert res.status_code == 201
    created = res.json()
    assert created["status"] == "Processing"
    case_id = created["id"]

    for _ in range(3):
        adv = client.post(f"/api/cases/{case_id}/processing/advance")
        assert adv.status_code == 200
        created = adv.json()
    assert all(w["status"] == "COMPLETE" for w in created["pipeline"]["workers"])
    assert created["status"] != "Processing"


def test_processing_abort_and_retry(client: TestClient) -> None:
    abort_res = client.post("/api/cases/CASE-2024-8840/processing/abort")
    assert abort_res.status_code == 200
    assert any(w["status"] == "ABORTED" for w in abort_res.json()["pipeline"]["workers"])

    retry_res = client.post("/api/cases/CASE-2024-8840/processing/retry")
    assert retry_res.status_code == 200
    assert retry_res.json()["status"] == "Processing"


def test_leptos_ocr_spatial_bounding_boxes(client: TestClient) -> None:
    detail = client.get("/api/cases/CASE-2024-8841").json()["case"]
    from app.models.schemas import DocumentArtifact

    docs = [DocumentArtifact(**d) for d in detail["documents"]]
    regions = extract_spatial_regions(docs)
    assert len(regions) >= 3
    assert len(regions[0]["xywh"]) == 4
    assert len(regions[0]["x1y1x2y2"]) == 4


def test_analyst_override_rejects_missing_justification(client: TestClient) -> None:
    res = client.patch(
        "/api/cases/CASE-2024-8841/ownership/nodes/node-sterling-8841",
        json={"determinationStatus": "MINORITY_EXEMPT", "analystNotes": "ok"},
    )
    assert res.status_code == 400


def test_analyst_override_and_add_node_and_commit(client: TestClient) -> None:
    patch_res = client.patch(
        "/api/cases/CASE-2024-8841/ownership/nodes/node-pendelton-8841",
        json={
            "determinationStatus": "CONFIRMED",
            "analystNotes": "Verified renewed UK passport and Kensington Square utility bill.",
        },
    )
    assert patch_res.status_code == 200

    add_res = client.post(
        "/api/cases/CASE-2024-8841/ownership/nodes",
        json={
            "parentId": "node-ahc-8841",
            "name": "Clara Vance",
            "kind": "NATURAL_PERSON",
            "legalForm": "Natural Person",
            "jurisdiction": "United Kingdom (GB)",
            "directPct": 10.0,
        },
    )
    assert add_res.status_code == 201
    assert any(n["name"] == "Clara Vance" and n["effectivePct"] == 6.0 for n in add_res.json()["ownershipNodes"])

    commit_res = client.post("/api/cases/CASE-2024-8841/ownership/commit")
    assert commit_res.status_code == 200
    assert commit_res.json()["ownershipCommitted"] is True


def test_export_cap_table_csv(client: TestClient) -> None:
    res = client.get("/api/cases/CASE-2024-8841/ownership/export-csv")
    assert res.status_code == 200
    assert "Arthur Pendelton" in res.text


def test_registry_refresh_accept_and_create_deficiency(client: TestClient) -> None:
    ref = client.post("/api/cases/CASE-2024-8841/registry/refresh")
    assert ref.status_code == 200

    acc = client.post("/api/cases/CASE-2024-8841/registry/accept-verified")
    assert acc.status_code == 200

    def_res = client.post("/api/cases/CASE-2024-8841/registry/fields/REG-008/create-deficiency")
    assert def_res.status_code == 200
    assert any("CH.FIELD_008" in d["regulatoryNote"] for d in def_res.json()["deficiencies"])

    cert = client.get("/api/cases/CASE-2024-8841/registry/export")
    assert cert.status_code == 200
    assert cert.json()["caseId"] == "CASE-2024-8841"


def test_document_annotation_flag_and_download(client: TestClient) -> None:
    ann = client.post(
        "/api/cases/CASE-2024-8841/documents/DOC-8841-1/annotation",
        json={"annotation": "Confirmed AD01 filing discrepancy via London Registry."},
    )
    assert ann.status_code == 200

    flg = client.post(
        "/api/cases/CASE-2024-8841/documents/DOC-8841-1/flag-deficiency",
        json={"bboxId": "bbox-1"},
    )
    assert flg.status_code == 200

    dl = client.get("/api/cases/CASE-2024-8841/documents/DOC-8841-1/download")
    assert dl.status_code == 200
    assert "Harbor Crest Holdings Ltd" in dl.text
    assert "ARTICLES OF ASSOCIATION" in dl.text


def test_deficiency_crud_and_outreach(client: TestClient) -> None:
    create = client.post(
        "/api/cases/CASE-2024-8841/deficiencies",
        json={"title": "Certified Cayman Register", "severity": "STANDARD_WARNING"},
    )
    assert create.status_code == 201
    new_id = create.json()["deficiencies"][0]["id"]

    rem = client.patch(
        f"/api/cases/CASE-2024-8841/deficiencies/{new_id}",
        json={"status": "REMEDIATED"},
    )
    assert rem.status_code == 200

    out = client.post("/api/cases/CASE-2024-8841/deficiencies/outreach", json={})
    assert out.status_code == 200
    assert out.json()["outreachDraft"]["sentCount"] == 1


def test_mcp_identity_service_verdict_only_privacy_boundary(client: TestClient) -> None:
    res = client.post(
        "/api/mcp/invoke",
        json={"tool": "identity_service", "caseId": "CASE-2024-8841"},
    )
    assert res.status_code == 200
    verdicts = res.json()["payload"]["verdicts"]
    assert len(verdicts) >= 2
    assert all(v["telemetryStored"] is False for v in verdicts)


def test_mcp_notifications_requires_approval_gate(client: TestClient) -> None:
    blocked = client.post(
        "/api/mcp/invoke",
        json={"tool": "notifications", "caseId": "CASE-2024-8841", "analystApproved": False},
    )
    assert blocked.status_code == 403
    assert blocked.json()["gatedBy"] == "APPROVAL_GATE_REQUIRED"

    allowed = client.post(
        "/api/mcp/invoke",
        json={"tool": "notifications", "caseId": "CASE-2024-8841", "analystApproved": True},
    )
    assert allowed.status_code == 200
    assert allowed.json()["allowed"] is True


def test_mcp_case_system_and_public_registries(client: TestClient) -> None:
    c_res = client.post(
        "/api/mcp/invoke",
        json={"tool": "case_system", "caseId": "CASE-2024-8841"},
    )
    r_res = client.post(
        "/api/mcp/invoke",
        json={"tool": "public_registries", "caseId": "CASE-2024-8841"},
    )
    assert c_res.status_code == 200
    assert r_res.status_code == 200
    assert r_res.json()["payload"]["discrepancies"] >= 1


def test_ai_gateway_outage_fallback_and_ubo_guardrail(client: TestClient) -> None:
    ok = client.post("/api/governance/ai-gateway/cases/CASE-2024-8841/assess")
    assert ok.status_code == 200
    assert ok.json()["degradedFallback"] is False
    assert ok.json()["uboPercentagesModified"] is False

    client.post("/api/governance/ai-gateway/toggle-outage", json={"outage": True})
    fb = client.post("/api/governance/ai-gateway/cases/CASE-2024-8841/assess")
    assert fb.status_code == 200
    assert fb.json()["degradedFallback"] is True
    assert fb.json()["uboPercentagesModified"] is False


def test_agentic_ai_workflow_run_and_human_gate_approval(client: TestClient) -> None:
    run_res = client.post("/api/cases/CASE-2024-8841/agent/run")
    assert run_res.status_code == 200
    trace = run_res.json()
    assert len(trace["steps"]) == 7
    assert trace["gateStatus"] == "AWAITING_ANALYST_APPROVAL"
    assert trace["uboPercentagesModified"] is False

    bad_approve = client.post(
        "/api/cases/CASE-2024-8841/agent/approve-gate",
        json={"runId": trace["runId"], "justification": "no"},
    )
    assert bad_approve.status_code == 400

    approve = client.post(
        "/api/cases/CASE-2024-8841/agent/approve-gate",
        json={
            "runId": trace["runId"],
            "analystName": "Marcus Vance",
            "justification": "Reviewed all 7 agent steps and verified RM outreach items.",
        },
    )
    assert approve.status_code == 200
    assert approve.json()["gateStatus"] == "APPROVED_BY_ANALYST"


def test_emergency_kill_switch_freezes_workers_outreach_and_agent(client: TestClient) -> None:
    ks = client.post(
        "/api/governance/kill-switch",
        json={"active": True, "reason": "Security alert test"},
    )
    assert ks.status_code == 200
    assert ks.json()["active"] is True

    assert client.post("/api/cases/CASE-2024-8840/processing/advance").status_code == 423
    assert client.post("/api/cases/CASE-2024-8841/deficiencies/outreach", json={}).status_code == 423
    assert (
        client.post(
            "/api/mcp/invoke",
            json={"tool": "public_registries", "caseId": "CASE-2024-8841"},
        ).status_code
        == 403
    )

    agent_blocked = client.post("/api/cases/CASE-2024-8841/agent/run")
    assert agent_blocked.json()["gateStatus"] == "BLOCKED_KILL_SWITCH"


def test_worm_audit_chain_verification_and_executive_signoff(client: TestClient) -> None:
    verify_res = client.post("/api/cases/CASE-2024-8841/audit/verify")
    assert verify_res.status_code == 200
    assert verify_res.json()["valid"] is True
    assert verify_res.json()["checkedCount"] == 5

    sign = client.post(
        "/api/cases/CASE-2024-8841/audit/sign-off",
        json={"action": "APPROVE_LOCK", "officerName": "Elena Rostova"},
    )
    assert sign.status_code == 200
    assert sign.json()["case"]["auditLocked"] is True

    verify_after = client.post("/api/cases/CASE-2024-8841/audit/verify")
    assert verify_after.json()["valid"] is True
    assert verify_after.json()["checkedCount"] == 6

    exp = client.get("/api/cases/CASE-2024-8841/audit/export?format=csv")
    assert exp.status_code == 200
    assert "SHA-256" not in exp.text or "SEQUENCE" in exp.text


def test_worm_audit_detects_tampering(client: TestClient) -> None:
    from app.models.schemas import AuditEvent

    raw_events = client.get("/api/cases/CASE-2024-8841/audit").json()["events"]
    events = [AuditEvent(**e) for e in raw_events]
    assert verify_chain_integrity("CASE-2024-8841", events).valid is True

    # Tamper with description of sequence #2
    for e in events:
        if e.sequence == 2:
            e.description = "TAMPERED DESCRIPTION"
    tampered = verify_chain_integrity("CASE-2024-8841", events)
    assert tampered.valid is False
    assert tampered.brokenAtSequence == 2
