# Project Northgate — Jobs-to-be-Done (JTBD) & Acceptance Specification

## Core Operational Jobs-to-be-Done

1. **Intake & Triage Queue (`IntakeQueueView`)**:
   - *JTBD*: Ingest multi-document corporate onboarding packets (`PDF`, `ZIP`, `TIFF`), track SLA cycle times (`< 5m`), filter by status/jurisdiction, and inspect extracted entity topology previews.
   - *Acceptance*: Uploading a bundle computes SHA-256 checksums, creates a case, and dispatches the 4-worker DAG pipeline.
2. **Parallel Extraction Pipeline (`ProcessingStateView`)**:
   - *JTBD*: Monitor Entity Parser, Registry Lookup, Ownership Reconciliation, and Document Scanner workers (`< 90s` target), inspect live engine telemetry, and abort/retry on failures.
3. **Multi-Tier Ownership & UBO Reconciliation (`OwnershipWorkbenchView`)**:
   - *JTBD*: Visualize multi-layer corporate hierarchies, mathematically resolve qualified UBOs (`≥ 25.0%`), inspect declared vs. PSC register disparities, and record justified analyst determinations.
4. **Public Registry Reconciliation (`RegistryReconciliationView`)**:
   - *JTBD*: Cross-check declared fields against UK Companies House, GLEIF, and OpenCorporates; batch-accept exact matches; escalate critical discrepancies (e.g. `CH.FIELD_004` Registered Office Address mismatch) into remediation tickets.
5. **Evidentiary Document Inspection (`DocumentViewerView`)**:
   - *JTBD*: Review scanned legal filings with toggleable OCR bounding boxes (`[x, y, w, h]` & confidence scores), annotate findings, and flag bounding regions directly as deficiencies.
6. **Deficiency Punch List & RM Outreach (`DeficiencyPunchListView`)**:
   - *JTBD*: Triage critical blockers vs. standard warnings, select items for outreach, review/edit the generated remediation notice, and dispatch via the approval-gated Secure RM Portal.
7. **Cryptographic Audit Trail & 4-Eye Sign-Off (`AuditTrailView`)**:
   - *JTBD*: Search and filter immutable SEC 17a-4 / FINRA WORM audit logs, verify SHA-256 chain integrity, export JSON/CSV packages, and execute Compliance VP lock & sign-off.
