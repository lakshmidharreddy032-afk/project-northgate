# Project Northgate — Institutional KYC/AML Automation Platform

Project Northgate is an institutional-grade Know Your Customer (KYC), Anti-Money Laundering (AML), and corporate onboarding verification platform designed to accelerate corporate client onboarding from weeks into a compliant, defensible, and audited workflow.

## Architecture & Governance Sources of Truth

- **Scope & Acceptance Criteria:** `docs/jtbd-spec.md`
- **Component Architecture & Rules:** `docs/architecture.md`
- **Scope Decisions & Gaps:** `docs/decisions.md`
- **GCP Deployment Guide:** `docs/deployment-gcp.md`
- **Engineering & Working Rules:** `AGENTS.md`
- **Screen Designs:** `designs/stitch/`

## Key System Features

- **4-Worker Orchestrator Pipeline (`backend/app/orchestrator/`)**: Entity Parser (`ocr/leptos_ocr.py`), Registry Lookup, Ownership Reconciliation (`models/ubo.py`), and Document Scanner.
- **Bounded Agentic AI Workflow (`backend/app/agent/kyc_agent.py`)**: Executes a 7-step autonomous KYC loop (`PLAN -> ocr.leptos_extract -> mcp://public_registries -> models.recalculate_ownership_tree -> mcp://identity_service -> ai_gateway.assess -> HUMAN_GATE`) with read-only UBO math guardrails and mandatory analyst sign-off.
- **Gated MCP Server (`backend/app/mcp/gated_tools.py`)**: `identity_service` (verdicts only, zero raw biometric telemetry), `case_system`, approval-gated `notifications`, and `public_registries`.
- **AI Gateway (`backend/app/ai_gateway/gateway.py`)**: Strict Pydantic schema validation, outage simulation, and circuit-breaker fallback.
- **Cryptographic WORM Audit Log (`backend/app/audit/worm_log.py`)**: Append-only SHA-256 hash chain with `verify_chain_integrity()`.
- **Institutional Frontend (`frontend/` — React 19 + TypeScript + Vite + Tailwind CSS)**: All 7 production screens plus Settings & Governance Policy console.

## Getting Started

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

To build the static production bundle:

```bash
cd frontend
npm run build
```

### Running the Backend API

```powershell
$env:PYTHONPATH='backend'
& "C:\Program Files\Python313\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger API documentation is available at `http://127.0.0.1:8000/docs`.

### Running the Test Suite

```powershell
& "C:\Program Files\Python313\python.exe" -m pytest backend/tests/ -v
```

### Docker Compose

```bash
docker compose up --build
```
- Frontend (Nginx): `http://localhost:3000`
- Backend API: `http://localhost:8000` (healthcheck at `/health`)
