# syntax=docker/dockerfile:1.7
ARG BUILD_FROM=ghcr.io/home-assistant/base:3.23
FROM ${BUILD_FROM}

ARG BUILD_ARCH
ARG BUILD_VERSION
ARG TUNNEL_CLIENT_VERSION=0.0.11
ARG TUNNEL_CLIENT_SHA256_AMD64=29adfe5c1399dfb9fda9383f230c324355912f50dc36e2e416b1f1322317b3c4
ARG TUNNEL_CLIENT_SHA256_AARCH64=d8bba47b2a723799a372b0b87d7e4d69304093d3a28837237315fe5406d97e77

RUN set -eux; \
    apk add --no-cache nodejs npm; \
    apk add --no-cache --virtual .tunnel-fetch curl unzip; \
    case "${BUILD_ARCH}" in \
      amd64) tunnel_arch=amd64; tunnel_sha256="${TUNNEL_CLIENT_SHA256_AMD64}" ;; \
      aarch64|arm64) tunnel_arch=arm64; tunnel_sha256="${TUNNEL_CLIENT_SHA256_AARCH64}" ;; \
      *) echo "Unsupported BUILD_ARCH: ${BUILD_ARCH}" >&2; exit 1 ;; \
    esac; \
    tunnel_asset="tunnel-client-v${TUNNEL_CLIENT_VERSION}-linux-${tunnel_arch}.zip"; \
    curl --fail --silent --show-error --location --retry 3 \
      "https://persistent.oaistatic.com/tunnel-client/v${TUNNEL_CLIENT_VERSION}/${tunnel_asset}" \
      --output "/tmp/${tunnel_asset}"; \
    echo "${tunnel_sha256}  /tmp/${tunnel_asset}" | sha256sum -c; \
    unzip -q "/tmp/${tunnel_asset}" -d /tmp/tunnel-client; \
    cp /tmp/tunnel-client/tunnel-client /usr/bin/tunnel-client; \
    cp /tmp/tunnel-client/cloudflared /usr/bin/cloudflared; \
    chmod 0755 /usr/bin/tunnel-client /usr/bin/cloudflared; \
    mkdir -p /usr/share/licenses/tunnel-client; \
    cp /tmp/tunnel-client/LICENSE /usr/share/licenses/tunnel-client/LICENSE; \
    rm -rf "/tmp/${tunnel_asset}" /tmp/tunnel-client; \
    apk del .tunnel-fetch

WORKDIR /opt/family-dashboard
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force
COPY app/src ./src
COPY app/config ./config
COPY app/frontend ./frontend

COPY rootfs /
RUN chmod a+x \
    /etc/services.d/family-dashboard-manager/run \
    /etc/services.d/family-dashboard-tunnel/run

ENV APP_VERSION=0.6.0 \
    MANAGER_HOST=127.0.0.1 \
    MANAGER_PORT=8099 \
    MANAGER_CONFIG_DIR=/config/family-dashboard \
    MANAGER_DATA_DIR=/data \
    MANAGER_RESOURCE_DIR=/config/www/family-dashboard \
    MANAGER_PUBLIC_RESOURCE_BASE=/local/family-dashboard \
    MANAGER_REQUIRE_READ_ONLY=true

LABEL \
    io.hass.version="${BUILD_VERSION}" \
    io.hass.type="app" \
    io.hass.arch="${BUILD_ARCH}" \
    org.opencontainers.image.title="Home Assistant App: Family Dashboard Manager" \
    org.opencontainers.image.description="Safely validates, deploys and rolls back the Family Dashboard." \
    org.opencontainers.image.source="https://github.com/robwestwood1978/family-dashboard" \
    org.opencontainers.image.licenses="MIT"
