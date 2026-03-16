#!/usr/bin/env bash
# Deploy MuSeeum backend + frontend to Google Cloud Run.
# Usage: ./scripts/deploy.sh
#        GEMINI_API_KEY=xxx ./scripts/deploy.sh
#        REGION=europe-west1 ./scripts/deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Resolve project and region
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-europe-west9}"
AR_REPO="${AR_REPO:-museeum}"
API_SERVICE_NAME="${API_SERVICE_NAME:-museeum-api}"
FRONTEND_SERVICE_NAME="${FRONTEND_SERVICE_NAME:-museeum-web}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID not set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

# Optional: load GEMINI_API_KEY and MUSEEUM_APP_ID from museeum-api/.env if not in environment
if [ -f museeum-api/.env ]; then
  source museeum-api/.env 2>/dev/null || true
fi
[ -z "$GEMINI_API_KEY" ] && [ -f .env ] && source .env 2>/dev/null || true

echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

# Ensure required APIs are enabled
for api in run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com; do
  gcloud services enable "$api" --project="$PROJECT_ID" 2>/dev/null || true
done

# Create Artifact Registry repo if it doesn't exist
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  echo "Creating Artifact Registry repository: $AR_REPO"
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID"
fi

# Build substitution args (region, repo, service names only; secrets come from Secret Manager)
SUBST="_REGION=$REGION,_AR_REPO=$AR_REPO,_API_SERVICE_NAME=$API_SERVICE_NAME,_FRONTEND_SERVICE_NAME=$FRONTEND_SERVICE_NAME"
echo "Secrets (GEMINI_API_KEY, MUSEEUM_APP_ID, JUDGE_ACCESS_CODE) are read from Secret Manager (gemini-api-key, museeum-app-id, judge-access-code)."

echo ""
echo "Submitting Cloud Build..."
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project="$PROJECT_ID" \
  --substitutions="$SUBST" \
  .

echo ""
echo "Ensuring public access (allow unauthenticated)..."
gcloud run services add-iam-policy-binding "$API_SERVICE_NAME" \
  --region="$REGION" --project="$PROJECT_ID" \
  --member="allUsers" --role="roles/run.invoker" 2>/dev/null || true
gcloud run services add-iam-policy-binding "$FRONTEND_SERVICE_NAME" \
  --region="$REGION" --project="$PROJECT_ID" \
  --member="allUsers" --role="roles/run.invoker" 2>/dev/null || true

echo ""
echo "Deploy complete."
API_URL=$(gcloud run services describe "$API_SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
WEB_URL=$(gcloud run services describe "$FRONTEND_SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)
[ -n "$API_URL" ] && echo "  Backend:  $API_URL"
[ -n "$WEB_URL" ] && echo "  Frontend: $WEB_URL"
