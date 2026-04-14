#!/bin/sh
set -e

# loombot container entrypoint.
#
# Responsibilities:
#   1. Ensure /data/config.yaml exists — on first boot copy one of the
#      `configs/*.example.yaml` profile files based on $PROFILE.
#   2. Optionally materialize the Pubky recovery file from a base64 env var
#      (useful for platforms where file mounts are awkward).
#   3. Exec the bot with the right paths and permissions.

DATA=${DATA_DIR:-/data}
APP=${LOOMBOT_HOME:-/app}

mkdir -p "$DATA" "$DATA/secrets"

# --- 1. Profile / config.yaml ----------------------------------------------

CONFIG_FILE_PATH="$DATA/config.yaml"
if [ ! -f "$CONFIG_FILE_PATH" ]; then
	PROFILE=${PROFILE:-general-purpose}
	SRC="$APP/configs/${PROFILE}.example.yaml"

	# Accept `minimal` as an alias for the tiny top-level config.example.yaml
	if [ "$PROFILE" = "minimal" ]; then
		SRC="$APP/config.example.yaml"
	fi

	if [ ! -f "$SRC" ]; then
		echo "loombot: unknown PROFILE '$PROFILE'. Available profiles:"
		echo "  minimal"
		for f in "$APP"/configs/*.example.yaml; do
			[ -f "$f" ] || continue
			name=$(basename "$f" .example.yaml)
			echo "  $name"
		done
		exit 1
	fi

	echo "loombot: first boot — copying profile '$PROFILE' to $CONFIG_FILE_PATH"
	cp "$SRC" "$CONFIG_FILE_PATH"
fi

# --- 2. Optional pkarr recovery file from env ------------------------------

RECOVERY_PATH="${PUBKY_RECOVERY_FILE:-$DATA/secrets/operator.pkarr}"
if [ -n "${PUBKY_RECOVERY_FILE_B64:-}" ] && [ ! -f "$RECOVERY_PATH" ]; then
	echo "loombot: writing pkarr recovery file from PUBKY_RECOVERY_FILE_B64 → $RECOVERY_PATH"
	mkdir -p "$(dirname "$RECOVERY_PATH")"
	printf '%s' "$PUBKY_RECOVERY_FILE_B64" | base64 -d >"$RECOVERY_PATH"
	chmod 600 "$RECOVERY_PATH"
fi
# Always tell the loader where to find it, so config.yaml is path-agnostic.
export PUBKY_RECOVERY_FILE="$RECOVERY_PATH"

# --- 3. Runtime paths ------------------------------------------------------

export CONFIG_FILE="$CONFIG_FILE_PATH"
export LOCAL_DB_URL="$DATA/bot.sqlite"

# Permissions limited to what the bot actually needs.
READ_PATHS="${DATA},${APP},${DENO_DIR:-/deno-dir},/tmp"
WRITE_PATHS="${DATA},/tmp"

exec deno run \
	--allow-net \
	--allow-env \
	--allow-run \
	--allow-read="$READ_PATHS" \
	--allow-write="$WRITE_PATHS" \
	--allow-import=deno.land,cdn.skypack.dev,jsr.io,registry.npmjs.org,cdn.npmjs.org \
	"$APP/src/main.ts"
