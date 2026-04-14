// src/core/config/env_overrides_test.ts
// Unit tests for applyEnvOverrides — the layer that lets Docker/Umbrel/Start9
// installs patch config.yaml at runtime via environment variables.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyEnvOverrides } from "@core/config/loader.ts";
import { OperatorConfigSchema } from "@core/config/schema.ts";

function withEnv(
	vars: Record<string, string | undefined>,
	fn: () => void,
): void {
	const previous: Record<string, string | undefined> = {};
	for (const [k, v] of Object.entries(vars)) {
		previous[k] = Deno.env.get(k);
		if (v === undefined) Deno.env.delete(k);
		else Deno.env.set(k, v);
	}
	try {
		fn();
	} finally {
		for (const [k, v] of Object.entries(previous)) {
			if (v === undefined) Deno.env.delete(k);
			else Deno.env.set(k, v);
		}
	}
}

const VAR_NAMES = [
	"BOT_ADMIN_IDS",
	"LOCK_DM_CONFIG",
	"PUBKY_ENABLED",
	"PUBKY_RECOVERY_FILE",
	"PUBKY_APPROVAL_GROUP_CHAT_ID",
	"PUBKY_APPROVAL_TIMEOUT_HOURS",
];
function clearAllEnv(): Record<string, undefined> {
	const clear: Record<string, undefined> = {};
	for (const n of VAR_NAMES) clear[n] = undefined;
	return clear;
}

Deno.test("BOT_ADMIN_IDS parses comma-separated list", () => {
	withEnv({ ...clearAllEnv(), BOT_ADMIN_IDS: "123, 456 ,789" }, () => {
		const raw: Record<string, unknown> = { bot: {}, pubky: {}, features: {} };
		applyEnvOverrides(raw);
		const bot = raw.bot as Record<string, unknown>;
		assertEquals(bot.admin_ids, ["123", "456", "789"]);
	});
});

Deno.test("BOT_ADMIN_IDS empty string becomes empty array", () => {
	withEnv({ ...clearAllEnv(), BOT_ADMIN_IDS: "" }, () => {
		const raw: Record<string, unknown> = { bot: { admin_ids: [1, 2] }, features: {} };
		applyEnvOverrides(raw);
		assertEquals((raw.bot as Record<string, unknown>).admin_ids, []);
	});
});

Deno.test("LOCK_DM_CONFIG accepts 1/true/yes/on", () => {
	for (const v of ["1", "true", "True", "YES", "on"]) {
		withEnv({ ...clearAllEnv(), LOCK_DM_CONFIG: v }, () => {
			const raw: Record<string, unknown> = { bot: {}, features: {} };
			applyEnvOverrides(raw);
			assertEquals((raw.bot as Record<string, unknown>).lock_dm_config, true, `${v} → true`);
		});
	}
	for (const v of ["0", "false", "no", "off"]) {
		withEnv({ ...clearAllEnv(), LOCK_DM_CONFIG: v }, () => {
			const raw: Record<string, unknown> = { bot: { lock_dm_config: true }, features: {} };
			applyEnvOverrides(raw);
			assertEquals((raw.bot as Record<string, unknown>).lock_dm_config, false, `${v} → false`);
		});
	}
});

Deno.test("PUBKY_ENABLED overrides nested pubky.enabled", () => {
	withEnv({ ...clearAllEnv(), PUBKY_ENABLED: "1" }, () => {
		const raw: Record<string, unknown> = {
			bot: {},
			pubky: { enabled: false, recovery_file: "./secrets/x.pkarr" },
			features: {},
		};
		applyEnvOverrides(raw);
		assertEquals((raw.pubky as Record<string, unknown>).enabled, true);
		// untouched fields preserved
		assertEquals((raw.pubky as Record<string, unknown>).recovery_file, "./secrets/x.pkarr");
	});
});

Deno.test("PUBKY_RECOVERY_FILE overrides path", () => {
	withEnv({ ...clearAllEnv(), PUBKY_RECOVERY_FILE: "/data/secrets/op.pkarr" }, () => {
		const raw: Record<string, unknown> = { pubky: { enabled: true }, features: {} };
		applyEnvOverrides(raw);
		assertEquals(
			(raw.pubky as Record<string, unknown>).recovery_file,
			"/data/secrets/op.pkarr",
		);
	});
});

Deno.test("PUBKY_APPROVAL_GROUP_CHAT_ID parses number", () => {
	withEnv({ ...clearAllEnv(), PUBKY_APPROVAL_GROUP_CHAT_ID: "-1001234567890" }, () => {
		const raw: Record<string, unknown> = { pubky: {}, features: {} };
		applyEnvOverrides(raw);
		assertEquals(
			(raw.pubky as Record<string, unknown>).approval_group_chat_id,
			-1001234567890,
		);
	});
});

Deno.test("PUBKY_APPROVAL_TIMEOUT_HOURS overrides hours", () => {
	withEnv({ ...clearAllEnv(), PUBKY_APPROVAL_TIMEOUT_HOURS: "48" }, () => {
		const raw: Record<string, unknown> = { pubky: {}, features: {} };
		applyEnvOverrides(raw);
		assertEquals(
			(raw.pubky as Record<string, unknown>).approval_timeout_hours,
			48,
		);
	});
});

Deno.test("no env vars → raw object untouched", () => {
	withEnv(clearAllEnv(), () => {
		const raw: Record<string, unknown> = {
			bot: { admin_ids: [42] },
			pubky: { enabled: true },
			features: { help: { service: "help" } },
		};
		const snapshot = JSON.stringify(raw);
		applyEnvOverrides(raw);
		assertEquals(JSON.stringify(raw), snapshot);
	});
});

Deno.test("overrides + schema validation produces valid config", () => {
	withEnv({
		...clearAllEnv(),
		BOT_ADMIN_IDS: "999",
		PUBKY_ENABLED: "1",
		PUBKY_RECOVERY_FILE: "/data/secrets/op.pkarr",
		PUBKY_APPROVAL_GROUP_CHAT_ID: "-100",
	}, () => {
		const raw: Record<string, unknown> = {
			bot: {},
			pubky: {},
			features: {},
		};
		applyEnvOverrides(raw);
		const parsed = OperatorConfigSchema.safeParse(raw);
		assertEquals(parsed.success, true);
		if (parsed.success) {
			assertEquals(parsed.data.bot.admin_ids, ["999"]);
			assertEquals(parsed.data.pubky.enabled, true);
			assertEquals(parsed.data.pubky.recovery_file, "/data/secrets/op.pkarr");
			assertEquals(parsed.data.pubky.approval_group_chat_id, -100);
		}
	});
});
