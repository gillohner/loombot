// src/core/config.ts
// Environment-derived runtime flags only. Everything the operator configures
// lives in config.yaml (see src/core/config/loader.ts and runtime.ts).

export const CONFIG = {
	env: Deno.env.get("NODE_ENV") ?? "development",
	debug: (Deno.env.get("DEBUG") ?? "").toLowerCase() === "1",
	logMinLevel: (Deno.env.get("LOG_MIN_LEVEL") ?? "info").toLowerCase(),
	logPretty: (Deno.env.get("LOG_PRETTY") ?? "0").toLowerCase() === "1",
	enableDeletePinned: (Deno.env.get("ENABLE_DELETE_PINNED") ?? "0").toLowerCase() === "1",
	defaultMessageTtl: Number(Deno.env.get("DEFAULT_MESSAGE_TTL") ?? "0"),
	configFile: Deno.env.get("CONFIG_FILE") ?? "./config.yaml",
};

export function isProd(): boolean {
	return CONFIG.env === "production";
}
export function isDebug(): boolean {
	return CONFIG.debug && !isProd();
}

export type LogMinLevel = "debug" | "info" | "warn" | "error";
export function getMinLevel(): LogMinLevel {
	const v = CONFIG.logMinLevel;
	return ["debug", "info", "warn", "error"].includes(v) ? (v as LogMinLevel) : "info";
}
