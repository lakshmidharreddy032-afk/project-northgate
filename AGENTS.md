# AGENTS.md — Project Northgate Engineering & Governance Rules

1. **Architecture**:
   - Backend (`backend/app/`) uses FastAPI + Pydantic v2 (`C:\Program Files\Python313\python.exe`) organized into `agent/`, `ai_gateway/`, `audit/`, `fixtures/`, `mcp/`, `models/`, `ocr/`, `orchestrator/`, and `main.py`.
   - Frontend (`frontend/`) uses React 19 + TypeScript + Vite + Tailwind CSS + Oxlint.
2. **Hard Compliance Guardrails**:
   - **Deterministic UBO Calculation**: AI Gateway and KYC Agent outputs must NEVER set or override UBO ownership percentages.
   - **Biometric Privacy Boundary**: `identity_service` returns liveness verdicts only; raw biometric telemetry is never stored.
   - **Mandatory Human-in-the-Loop Gate**: Outbound communications via `notifications` require explicit analyst approval and are blocked if the Emergency Kill Switch is engaged.
   - **WORM Audit Trail**: Analyst overrides require a written regulatory justification and append a SHA-256 hash-chained audit record.
3. **Design Fidelity**:
   - All 7 operational screens (`Intake Queue`, `Processing State`, `Ownership Workbench`, `Registry Reconciliation`, `Document Viewer`, `Deficiency Punch List`, `Audit Trail`) follow `designs/stitch/`.
