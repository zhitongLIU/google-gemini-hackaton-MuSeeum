# MuSeeum - Makefile for local dev and GCP deploy
# Override: make deploy REGION=europe-west1 PROJECT_ID=my-project

REGION        ?= europe-west9
AR_REPO       ?= museeum
API_SERVICE   ?= museeum-api
WEB_SERVICE   ?= museeum-web
PROJECT_ID    ?= $(shell gcloud config get-value project 2>/dev/null)

.PHONY: help deploy deploy-api deploy-web setup build-api build-web run-api run-web build-logs

help:
	@echo "MuSeeum targets:"
	@echo "  make deploy       - Deploy both API and frontend to Cloud Run (set GEMINI_API_KEY or use Secret Manager)"
	@echo "  make deploy-api   - Deploy backend only"
	@echo "  make deploy-web   - Deploy frontend only (backend must already be deployed)"
	@echo "  make setup        - One-time GCP setup: enable APIs, create Artifact Registry repo"
	@echo "  make build-api    - Local Docker build of backend (no push)"
	@echo "  make build-web    - Local Docker build of frontend (no push; needs VITE_API_URL)"
	@echo "  make run-api      - Run backend locally (npm run dev in museeum-api)"
	@echo "  make run-web      - Run frontend locally (npm run dev in museeum-web)"
	@echo "  make build-logs   - Stream full Cloud Build logs (use BUILD_ID=xxx, e.g. from deploy failure)"
	@echo ""
	@echo "Variables: REGION, PROJECT_ID, AR_REPO, API_SERVICE, WEB_SERVICE"
	@echo "Example:   GEMINI_API_KEY=xxx make deploy"
	@echo "           BUILD_ID=e7f8f10d-4845-487e-aa6f-ebae14bbd60b make build-logs"

deploy:
	@if [ -z "$(PROJECT_ID)" ]; then echo "Error: set PROJECT_ID or run gcloud config set project YOUR_PROJECT"; exit 1; fi
	./scripts/deploy.sh

deploy-api:
	@if [ -z "$(PROJECT_ID)" ]; then echo "Error: set PROJECT_ID"; exit 1; fi
	cd museeum-api && docker build -t $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(AR_REPO)/$(API_SERVICE):latest .
	docker push $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(AR_REPO)/$(API_SERVICE):latest
	gcloud run deploy $(API_SERVICE) \
	  --image $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(AR_REPO)/$(API_SERVICE):latest \
	  --region $(REGION) \
	  --platform managed \
	  --allow-unauthenticated \
	  --set-env-vars "PORT=8080,GEMINI_API_KEY=$$GEMINI_API_KEY" \
	  --min-instances 0 \
	  --max-instances 10

deploy-web:
	@if [ -z "$(PROJECT_ID)" ]; then echo "Error: set PROJECT_ID"; exit 1; fi
	$(eval API_URL := $(shell gcloud run services describe $(API_SERVICE) --region $(REGION) --format 'value(status.url)' 2>/dev/null))
	@if [ -z "$(API_URL)" ]; then echo "Error: backend not deployed. Run make deploy or make deploy-api first"; exit 1; fi
	cd museeum-web && docker build --build-arg VITE_API_URL=$(API_URL) -t $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(AR_REPO)/$(WEB_SERVICE):latest .
	docker push $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(AR_REPO)/$(WEB_SERVICE):latest
	gcloud run deploy $(WEB_SERVICE) \
	  --image $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(AR_REPO)/$(WEB_SERVICE):latest \
	  --region $(REGION) \
	  --platform managed \
	  --allow-unauthenticated \
	  --set-env-vars "PORT=8080" \
	  --min-instances 0 \
	  --max-instances 10

setup:
	@if [ -z "$(PROJECT_ID)" ]; then echo "Error: set PROJECT_ID or gcloud config set project"; exit 1; fi
	gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=$(PROJECT_ID)
	@if ! gcloud artifacts repositories describe $(AR_REPO) --location=$(REGION) --project=$(PROJECT_ID) &>/dev/null; then \
	  gcloud artifacts repositories create $(AR_REPO) --repository-format=docker --location=$(REGION) --project=$(PROJECT_ID); \
	else \
	  echo "Artifact Registry repo $(AR_REPO) already exists"; \
	fi
	@echo "Setup done. Create secret for Gemini: echo -n YOUR_KEY | gcloud secrets create gemini-api-key --data-file=- --project=$(PROJECT_ID)"

build-api:
	cd museeum-api && docker build -t museeum-api:local .

build-web:
	cd museeum-web && docker build --build-arg VITE_API_URL=$${VITE_API_URL:-http://localhost:8080} -t museeum-web:local .

run-api:
	cd museeum-api && npm run dev

run-web:
	cd museeum-web && npm run dev

# Stream full Cloud Build logs (no truncation). BUILD_ID is in the deploy error output.
build-logs:
	@if [ -z "$(BUILD_ID)" ]; then echo "Usage: BUILD_ID=<build-uuid> make build-logs"; exit 1; fi
	gcloud builds log "$(BUILD_ID)" --project="$(PROJECT_ID)"
