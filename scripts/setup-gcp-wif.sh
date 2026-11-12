#!/usr/bin/env bash
set -euo pipefail

# One-time setup script for Google Cloud Shell to configure GitHub Actions -> Cloud Run CI/CD
# Usage:
#   export PROJECT_ID="your-gcp-project-id"
#   bash scripts/setup-gcp-wif.sh

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="asia-south1"
REPO_OWNER="lakshmidharreddy032-afk"
REPO_NAME="project-northgate"
SA_NAME="github-northgate-deployer"
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-provider"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: Set PROJECT_ID first, e.g.: export PROJECT_ID=my-gcp-project-id"
  exit 1
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "1) Enabling required GCP APIs on $PROJECT_ID..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="$PROJECT_ID"

echo "2) Creating Artifact Registry repository 'northgate' in $REGION..."
gcloud artifacts repositories describe northgate --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud artifacts repositories create northgate \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID"

echo "3) Creating service account '$SA_NAME' and granting Cloud Run / Artifact Registry roles..."
gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="GitHub Actions Northgate Deployer" \
    --project="$PROJECT_ID"

for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" >/dev/null
done

echo "4) Configuring Workload Identity Federation for ${REPO_OWNER}/${REPO_NAME}..."
gcloud iam workload-identity-pools describe "$POOL_NAME" --location="global" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL_NAME" \
    --location="global" \
    --display-name="GitHub Actions Pool" \
    --project="$PROJECT_ID"

gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
  --location="global" --workload-identity-pool="$POOL_NAME" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" \
    --display-name="GitHub Provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='${REPO_OWNER}/${REPO_NAME}'" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --project="$PROJECT_ID"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${REPO_OWNER}/${REPO_NAME}" >/dev/null

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"

echo ""
echo "================================================================="
echo "Add these 2 Repository Secrets in GitHub:"
echo "  https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions"
echo ""
echo "  GCP_WORKLOAD_IDENTITY_PROVIDER = ${WIF_PROVIDER}"
echo "  GCP_SERVICE_ACCOUNT            = ${SA_EMAIL}"
echo "================================================================="
