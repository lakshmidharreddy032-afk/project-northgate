# Project Northgate — GCP & Container Deployment Guide

## 1. Local Multi-Container Deployment (Docker Compose)
Both `backend` and `frontend` include standalone Dockerfiles designed for `docker-compose.yml`:

```bash
docker compose up --build
```
- **Backend (`./backend/Dockerfile`)**: Node 22 Alpine + `curl`, listens on `PORT=8080`, mapped to host `8000:8080`, healthcheck at `GET /health`.
- **Frontend (`./frontend/Dockerfile`)**: Multi-stage Vite build with `ARG VITE_API_URL=http://localhost:8000`, served via Nginx on port `8080` (`default_server`), mapped to host `3000:8080`.

## 2. Google Cloud Platform (GCP) Target Topology (`asia-south1`)
- **Artifact Registry**: Docker repository in `asia-south1` (`asia-south1-docker.pkg.dev/<PROJECT_ID>/northgate`).
- **Cloud Run Services (`asia-south1`)**:
  - `northgate-backend`: Built from `./backend`, port `8080`, `ENVIRONMENT=production`, health probe `/health`.
  - `northgate-frontend`: Built from `./frontend` with `VITE_API_URL` set to the deployed `northgate-backend` Cloud Run HTTPS URL, served by Nginx on port `8080`.
- **CI/CD Recommendations**:
  - Authenticate via Workload Identity Federation (`google-github-actions/auth`), bind project ID explicitly from auth outputs, ensure Artifact Registry repository exists in `asia-south1`, push tagged images, and deploy `backend` before building/deploying `frontend`.
