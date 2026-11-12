# Project Northgate — Architecture Decisions & Governance Gaps

## Scope & Implementation Decisions

1. **Full-Stack TypeScript Monorepo (`backend/` + `frontend/`)**:
   - Chosen to share strict domain models and the deterministic FATF/5AMLD ownership calculation algorithm (`recalculateOwnershipTree()`) identically across backend and frontend, while keeping `backend/` and `frontend/` self-contained for independent Docker build contexts.
2. **Deterministic UBO Calculation Over LLM Inference (PROVISIONAL-GAP-2, PROVISIONAL-GAP-9)**:
   - Beneficial ownership percentages (`Effective % = Π Direct %`) are always calculated mathematically in `ubo.ts`. The AI Gateway (`aiGateway.ts`) operates strictly in read-only triage/summarization mode and enforces `uboPercentagesModified: false`.
3. **Verdict-Only Biometric Privacy Boundary (PROVISIONAL-GAP-1, PROVISIONAL-GAP-8)**:
   - `identity_service` returns liveness verdicts (`LIVENESS_PASS`, `DOCUMENT_EXPIRED`, `PENDING`) with `telemetryStored: false` and never persists raw biometric data.
4. **Human-in-the-Loop Approval Gate & Emergency Kill Switch (PROVISIONAL-GAP-6)**:
   - Outbound applicant/RM notifications via `notifications` or `/api/cases/:id/deficiencies/outreach` cannot dispatch autonomously; they require explicit analyst review and are halted (`HTTP 423` / `403`) whenever the Emergency Kill Switch is engaged.
5. **Immutable WORM Audit Chain**:
   - Every analyst override requires a minimum written regulatory justification (`HTTP 400` if omitted) and appends a SHA-256 hash-chained event verifiable via `POST /api/cases/:id/audit/verify`.
6. **Public Registry Adapter Strategy (PROVISIONAL-GAP-4)**:
   - Synthetic/deterministic adapters emulate UK Companies House, GLEIF, and OpenCorporates responses with live latency telemetry and discrepancy detection.
