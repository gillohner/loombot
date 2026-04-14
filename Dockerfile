# syntax=docker/dockerfile:1.7
# loombot container image
#
# Build:   docker build -t loombot .
# Run:     docker compose up -d        (see docker-compose.yml)
#
# Persistent state lives in /data (volume-mounted):
#   /data/config.yaml        operator config (copied from a profile on first boot)
#   /data/bot.sqlite         per-chat override database
#   /data/secrets/           .pkarr recovery files if pubky is enabled

FROM denoland/deno:debian-2.7.11 AS base

ENV DENO_DIR=/deno-dir \
    LOOMBOT_HOME=/app \
    DATA_DIR=/data

WORKDIR ${LOOMBOT_HOME}

# Non-root user — avoid running the bot as root inside the container.
RUN groupadd --gid 1000 loombot \
    && useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash loombot \
    && mkdir -p ${DATA_DIR} ${DENO_DIR} \
    && chown -R loombot:loombot ${DATA_DIR} ${DENO_DIR} ${LOOMBOT_HOME}

# Copy source (ordered to maximise layer reuse — deno.json first for caching).
COPY --chown=loombot:loombot deno.json deno.lock ./
COPY --chown=loombot:loombot src ./src
COPY --chown=loombot:loombot packages ./packages
COPY --chown=loombot:loombot scripts ./scripts
COPY --chown=loombot:loombot configs ./configs
COPY --chown=loombot:loombot config.example.yaml ./config.example.yaml
COPY --chown=loombot:loombot docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER loombot

# Pre-cache third-party modules so first boot doesn't fetch them at runtime.
RUN deno cache --allow-import=deno.land,cdn.skypack.dev,jsr.io,registry.npmjs.org,cdn.npmjs.org \
        src/main.ts || true

VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
