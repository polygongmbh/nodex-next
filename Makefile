# --- Image identity ---------------------------------------------------------
# Registry namespace images are tagged/pushed under. Defaults to GitHub's
# registry (GHCR); override to push to a self-hosted Forgejo/registry instead.
REGISTRY ?= ghcr.io/polygongmbh
NAME     ?= nodex-next

# Version tag: <commit-date>-<short-sha>, plus -dirty when the tree has
# uncommitted changes. Traceable to source and sorts chronologically.
GIT_SHA  := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
GIT_DATE := $(shell git show -s --format=%cd --date=format:%Y%m%d HEAD 2>/dev/null || echo 00000000)
DIRTY    := $(shell git diff --quiet 2>/dev/null || echo -dirty)
VERSION  ?= $(GIT_DATE)-$(GIT_SHA)$(DIRTY)

REPO  := $(if $(REGISTRY),$(REGISTRY)/$(NAME),$(NAME))
IMAGE ?= $(REPO):$(VERSION)

.PHONY: build push release deploy version

# Print the computed image ref (handy: `make version`).
version:
	@echo $(IMAGE)

# Build, tagging the immutable version and moving `latest`. Bakes APP_VERSION
# into the image (served at /version.txt) and VITE_* from ./.env if present.
build:
	docker build \
	  --build-arg APP_VERSION=$(VERSION) \
	  -t $(REPO):$(VERSION) \
	  -t $(REPO):latest \
	  .

# Push both tags (needs REGISTRY set + `docker login <registry>`).
push:
	docker push $(REPO):$(VERSION)
	docker push $(REPO):latest

# Build + push, refusing a dirty tree so every pushed tag is reproducible.
release:
	@[ -z "$(DIRTY)" ] || { echo "refusing to release dirty tree ($(VERSION)); commit first"; exit 1; }
	@$(MAKE) build
	@$(MAKE) push

# Deploy a prebuilt/pushed image (registry flow: run `make release` first). The
# local single-node flow is `./deploy/deploy.sh` directly — it builds for you.
deploy:
	SKIP_BUILD=1 IMAGE=$(IMAGE) ./deploy/deploy.sh
