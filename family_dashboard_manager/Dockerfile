# syntax=docker/dockerfile:1.7
ARG BUILD_FROM=ghcr.io/home-assistant/base:3.23
FROM ghcr.io/openai/tunnel-client:v0.0.10 AS tunnel
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs npm

COPY --from=tunnel /usr/bin/tunnel-client /usr/bin/tunnel-client
COPY --from=tunnel /usr/bin/cloudflared /usr/bin/cloudflared

WORKDIR /opt/family-dashboard
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force
COPY app/src ./src

COPY rootfs /
RUN chmod a+x \
    /etc/services.d/family-dashboard-manager/run \
    /etc/services.d/family-dashboard-tunnel/run

ENV APP_VERSION=0.1.0 \
    MANAGER_HOST=127.0.0.1 \
    MANAGER_PORT=8099 \
    MANAGER_CONFIG_DIR=/config/family-dashboard \
    MANAGER_DATA_DIR=/data

LABEL \
    org.opencontainers.image.title="Home Assistant App: Family Dashboard Manager" \
    org.opencontainers.image.description="Safely validates, deploys and rolls back a dedicated Family Dashboard." \
    org.opencontainers.image.source="https://github.com/robwestwood1978/family-dashboard" \
    org.opencontainers.image.licenses="MIT"
