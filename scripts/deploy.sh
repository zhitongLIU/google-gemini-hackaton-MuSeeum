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

# Build substitution args
SUBST="_REGION=$REGION,_AR_REPO=$AR_REPO,_API_SERVICE_NAME=$API_SERVICE_NAME,_FRONTEND_SERVICE_NAME=$FRONTEND_SERVICE_NAME"
if [ -n "$GEMINI_API_KEY" ]; then
  SUBST="$SUBST,_GEMINI_API_KEY=$GEMINI_API_KEY"
  echo "Using GEMINI_API_KEY from environment (or .env)"
else
  echo "No GEMINI_API_KEY set. Backend Live API will fail until you set the secret or pass the key."
  echo "  Option 1: GEMINI_API_KEY=your_key $0"
  echo "  Option 2: Create Secret Manager secret 'gemini-api-key' and update cloudbuild.yaml to use --set-secrets"
fi
if [ -n "$MUSEEUM_APP_ID" ]; then
  SUBST="$SUBST,_MUSEEUM_APP_ID=$MUSEEUM_APP_ID"
  echo "Using MUSEEUM_APP_ID (only museeum-web will be able to call the API)"
else
  echo "No MUSEEUM_APP_ID set. Any client can call the API. Set MUSEEUM_APP_ID (and VITE_MUSEEUM_APP_ID for the frontend build) to restrict to museeum-web."
fi
if [ -n "$JUDGE_ACCESS_CODE" ]; then
  SUBST="$SUBST,_JUDGE_ACCESS_CODE=$JUDGE_ACCESS_CODE"
  echo "Using JUDGE_ACCESS_CODE (only users with this code can use the app)"
else
  echo "No JUDGE_ACCESS_CODE set. Anyone can use the app. Set JUDGE_ACCESS_CODE to restrict to judges/organizers."
fi

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
