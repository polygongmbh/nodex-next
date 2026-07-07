# Build stage: compile the Vite/Svelte app to static files
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage: static files behind nginx
FROM nginx:1.27-alpine
ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="nodex-next" \
      org.opencontainers.image.version="${APP_VERSION}"
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Stamp the build id so `curl https://<host>/version.txt` shows what is live.
RUN printf '%s\n' "${APP_VERSION}" > /usr/share/nginx/html/version.txt
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
