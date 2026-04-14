// src/core/config/runtime.ts
// Holds the loaded operator config as a process-wide singleton. Set once at
// startup in bot.ts; read by the snapshot builder, router, and /config UI.

import type { OperatorConfig } from "@core/config/schema.ts";

let current: OperatorConfig | null = null;
let currentHash: string | null = null;

export function setOperatorConfig(config: OperatorConfig, hash: string): void {
	current = config;
	currentHash = hash;
}

export function getOperatorConfig(): OperatorConfig {
	if (!current) throw new Error("Operator config not loaded. Call setOperatorConfig first.");
	return current;
}

export function getOperatorConfigHash(): string {
	if (!currentHash) throw new Error("Operator config not loaded.");
	return currentHash;
}
