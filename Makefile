IMAGE ?= nodex-next:latest

.PHONY: build push deploy

# Build the image (bakes VITE_* from ./.env if present in the context).
build:
	docker build -t $(IMAGE) .

# Push to a registry — required for abra and any multi-node swarm.
push:
	docker push $(IMAGE)

# Expand DOMAINS into a Traefik rule and docker stack deploy (plain swarm).
deploy:
	IMAGE=$(IMAGE) ./deploy/deploy.sh
