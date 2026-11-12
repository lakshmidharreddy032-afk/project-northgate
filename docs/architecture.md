# Project Northgate — System Architecture & Rules

## 1. Overview
Project Northgate is a full-stack **TypeScript** institutional KYC/AML & UBO reconciliation workbench operating as a non-invasive read/staging ingestion sidecar. It extracts evidentiary fields with spatial OCR bounding boxes, reconciles declared corporate data against authoritative public registries, calculates multi-tier beneficial ownership (`≥ 25.0%` statutory threshold), generates remediation deficiency punch lists, and enforces human-in-the-loop analyst and executive (4-eye) approval gates.

## 2. Component Topology
- **`frontend/` (`React 19 + TypeScript + Vite + Tailwind CSS`)**:
  - 7 operational screens (`Intake Queue`, `Processing State`, `Ownership Workbench`, `Registry Reconciliation`, `Document Viewer`, `Deficiency Punch List`, `Audit Trail`) plus `Settings & Policy` governance console.
  - Served via Vite in dev (`:5173`) or Nginx on port `8080` (mapped `:3000` in Docker Compose).
- **`backend/` (`Express 5 + TypeScript + Node 22`)**:
  - **4-Worker DAG Pipeline (`backend/src/routes.ts`)**:
    1. *Entity Parser*: Extracts legal entities, directors, shareholders, and spatial bounding boxes (`[x, y, w, h]`).
    2. *Registry Lookup*: Cross-queries UK Companies House, GLEIF, and OpenCorporates.
    3. *Ownership Reconciliation (`backend/src/shared/ubo.ts`)*: Deterministic path multiplication (`Effective % = Π (Direct % × Tier Ownership %)`).
    4. *Document Scanner*: Identifies missing filings, expired IDs, and registry mismatches.
  - **Gated MCP Server (`backend/src/mcpServer.ts`)**:
    - `identity_service`: Biometric liveness verdicts only (`telemetryStored: false`).
    - `case_system`: Non-invasive case/cap-table staging sidecar.
    - `notifications`: Blocked unless explicit analyst sign-off & Kill Switch is inactive.
    - `public_registries`: Circuit-breaker gated registry bridge.
  - **AI Gateway (`backend/src/aiGateway.ts`)**:
    - Schema-validated triage summary proxy with circuit-breaker outage fallback.
    - Hard guardrail: AI output never sets or overrides UBO ownership percentages.
  - **Cryptographic WORM Audit Log (`backend/src/cryptoAudit.ts`)**:
    - Append-only SHA-256 hash-chained events (`verifyAuditChain()`).
    - Rejects analyst overrides without written regulatory justification.
