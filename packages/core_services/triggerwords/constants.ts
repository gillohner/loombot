// packages/core_services/triggerwords/constants.ts
// Triggerwords - Listener service that responds with jokes when trigger words are detected

import type { DatasetSchemas, JSONSchema, ValidationError, ValidationResult } from "@sdk/mod.ts";
export type { ValidationError, ValidationResult };

// ============================================================================
// Service Identity
// ============================================================================

export const TRIGGERWORDS_SERVICE_ID = "triggerwords" as const;
export const TRIGGERWORDS_VERSION = "1.0.0" as const;

// ============================================================================
// Types
// ============================================================================

export interface TriggerEntry {
	/** Words that trigger this response (case-insensitive) */
	triggers: string[];
	/** Possible responses - one will be picked randomly */
	responses: string[];
	/** Whether this trigger is enabled (default: true) */
	enabled?: boolean;
	/** Match mode: "word" matches whole words only, "contains" matches anywhere (default: "word") */
	matchMode?: "word" | "contains";
}

export interface TriggerwordsDataset {
	version: string;
	description?: string;
	entries: TriggerEntry[];
}

export interface TriggerwordsConfig {
	/** Probability of responding (0-1, default: 1.0 = always respond) */
	responseProbability?: number;
	/** Cooldown in seconds between responses in the same chat (default: 0 = no cooldown) */
	cooldownSeconds?: number;
	/** Whether to reply to the message or send standalone (default: false) */
	replyToMessage?: boolean;
}

// ============================================================================
// JSON Schemas
// ============================================================================

export const TRIGGER_ENTRY_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		triggers: {
			type: "array",
			items: { type: "string" },
			description: "Words that trigger this response (case-insensitive)",
		},
		responses: {
			type: "array",
			items: { type: "string" },
			description: "Possible responses - one will be picked randomly",
		},
		enabled: {
			type: "boolean",
			description: "Whether this trigger is enabled (default: true)",
		},
		matchMode: {
			type: "string",
			enum: ["word", "contains"],
			description:
				"Match mode: 'word' matches whole words only, 'contains' matches anywhere (default: word)",
		},
	},
	required: ["triggers", "responses"],
};

export const TRIGGERWORDS_DATASET_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		version: {
			type: "string",
			description: "Dataset version",
		},
		description: {
			type: "string",
			description: "Description of this trigger set",
		},
		entries: {
			type: "array",
			items: TRIGGER_ENTRY_SCHEMA,
			description: "List of trigger entries",
		},
	},
	required: ["version", "entries"],
};

export const TRIGGERWORDS_CONFIG_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		responseProbability: {
			type: "number",
			description: "Probability of responding (0-1, default: 1.0 = always respond)",
			default: 1.0,
		},
		cooldownSeconds: {
			type: "integer",
			description: "Cooldown in seconds between responses in the same chat (default: 0)",
			default: 0,
		},
		replyToMessage: {
			type: "boolean",
			description: "Whether to reply to the message or send standalone (default: false)",
			default: false,
		},
		messageTtl: {
			type: "integer",
			title: "Message TTL",
			description: "Auto-delete bot messages after this many seconds (0 to keep forever)",
			minimum: 0,
			default: 0,
		},
	},
};

export const TRIGGERWORDS_DATASET_SCHEMAS: DatasetSchemas = {
	triggers: {
		schema: TRIGGERWORDS_DATASET_SCHEMA,
		description: "Trigger words and their joke responses",
		required: false,
		example: {
			version: "1.0.0",
			entries: [
				{
					triggers: ["ethereum", "eth"],
					responses: ["Ethereum joke here!"],
					enabled: true,
				},
			],
		},
	},
};

// ============================================================================
// Validation Functions
// ============================================================================

export function validateTriggerEntry(data: unknown, index: number): ValidationError[] {
	const errors: ValidationError[] = [];
	const prefix = `entries[${index}]`;

	if (typeof data !== "object" || data === null) {
		errors.push({ path: prefix, message: "Entry must be an object" });
		return errors;
	}

	const entry = data as Record<string, unknown>;

	if (!Array.isArray(entry.triggers)) {
		errors.push({ path: `${prefix}.triggers`, message: "triggers must be an array" });
	} else if (entry.triggers.length === 0) {
		errors.push({ path: `${prefix}.triggers`, message: "triggers cannot be empty" });
	} else {
		entry.triggers.forEach((t, i) => {
			if (typeof t !== "string" || t.trim().length === 0) {
				errors.push({
					path: `${prefix}.triggers[${i}]`,
					message: "trigger must be a non-empty string",
				});
			}
		});
	}

	if (!Array.isArray(entry.responses)) {
		errors.push({ path: `${prefix}.responses`, message: "responses must be an array" });
	} else if (entry.responses.length === 0) {
		errors.push({ path: `${prefix}.responses`, message: "responses cannot be empty" });
	} else {
		entry.responses.forEach((r, i) => {
			if (typeof r !== "string" || r.trim().length === 0) {
				errors.push({
					path: `${prefix}.responses[${i}]`,
					message: "response must be a non-empty string",
				});
			}
		});
	}

	if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") {
		errors.push({ path: `${prefix}.enabled`, message: "enabled must be a boolean" });
	}

	if (entry.matchMode !== undefined) {
		const validModes = ["word", "contains"];
		if (!validModes.includes(entry.matchMode as string)) {
			errors.push({
				path: `${prefix}.matchMode`,
				message: `matchMode must be one of: ${validModes.join(", ")}`,
			});
		}
	}

	return errors;
}

export function validateDataset(data: unknown): ValidationResult {
	const errors: ValidationError[] = [];

	if (typeof data !== "object" || data === null) {
		errors.push({ path: "", message: "Dataset must be an object" });
		return { valid: false, errors };
	}

	const dataset = data as Record<string, unknown>;

	if (typeof dataset.version !== "string") {
		errors.push({ path: "version", message: "version is required and must be a string" });
	}

	if (!Array.isArray(dataset.entries)) {
		errors.push({ path: "entries", message: "entries is required and must be an array" });
	} else {
		dataset.entries.forEach((entry, i) => {
			errors.push(...validateTriggerEntry(entry, i));
		});
	}

	return { valid: errors.length === 0, errors };
}

export function validateConfig(data: unknown): ValidationResult {
	const errors: ValidationError[] = [];

	if (typeof data !== "object" || data === null) {
		errors.push({ path: "", message: "Config must be an object" });
		return { valid: false, errors };
	}

	const config = data as Record<string, unknown>;

	if (config.responseProbability !== undefined) {
		if (typeof config.responseProbability !== "number") {
			errors.push({ path: "responseProbability", message: "responseProbability must be a number" });
		} else if (config.responseProbability < 0 || config.responseProbability > 1) {
			errors.push({
				path: "responseProbability",
				message: "responseProbability must be between 0 and 1",
			});
		}
	}

	if (config.cooldownSeconds !== undefined) {
		if (typeof config.cooldownSeconds !== "number" || !Number.isInteger(config.cooldownSeconds)) {
			errors.push({ path: "cooldownSeconds", message: "cooldownSeconds must be an integer" });
		} else if (config.cooldownSeconds < 0) {
			errors.push({ path: "cooldownSeconds", message: "cooldownSeconds must be non-negative" });
		}
	}

	if (config.replyToMessage !== undefined && typeof config.replyToMessage !== "boolean") {
		errors.push({ path: "replyToMessage", message: "replyToMessage must be a boolean" });
	}

	return { valid: errors.length === 0, errors };
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIG: TriggerwordsConfig = {
	responseProbability: 1.0,
	cooldownSeconds: 0,
	replyToMessage: false,
};

export const DEFAULT_DATASET: TriggerwordsDataset = {
	version: "1.0.0",
	description: "Example trigger words",
	entries: [
		{
			triggers: ["ethereum", "eth"],
			responses: [
				"🎰 Ethereum: Where 'gas fees' cost more than your actual transaction!",
				"📉 ETH? More like 'Eventually They'll Hodl' forever...",
				"⛽ Ethereum: Making banks look cheap since 2015!",
				"🔥 I tried to send $5 in ETH once. The gas fee was $47.",
				"🐌 Ethereum 2.0 is coming! ...any decade now.",
			],
			enabled: true,
			matchMode: "word",
		},
		{
			triggers: ["bitcoin", "btc"],
			responses: [
				"₿ Bitcoin: Digital gold that your grandma still doesn't understand.",
				"🍕 Remember when someone bought 2 pizzas for 10,000 BTC? That's now worth... *checks notes* ...a small country.",
				"⚡ Bitcoin: Slow, expensive, but hey, at least it's volatile!",
				"🌙 To the moon! ...eventually... maybe... we hope.",
			],
			enabled: true,
			matchMode: "word",
		},
	],
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if text contains a trigger word
 */
export function findMatchingEntry(
	text: string,
	entries: TriggerEntry[],
): TriggerEntry | null {
	const lowerText = text.toLowerCase();

	for (const entry of entries) {
		if (entry.enabled === false) continue;

		for (const trigger of entry.triggers) {
			const lowerTrigger = trigger.toLowerCase();
			const matchMode = entry.matchMode || "word";

			if (matchMode === "contains") {
				if (lowerText.includes(lowerTrigger)) {
					return entry;
				}
			} else {
				// Word boundary match
				const wordRegex = new RegExp(`\\b${escapeRegex(lowerTrigger)}\\b`, "i");
				if (wordRegex.test(text)) {
					return entry;
				}
			}
		}
	}

	return null;
}

/**
 * Pick a random response from an entry
 */
export function pickRandomResponse(entry: TriggerEntry): string {
	const index = Math.floor(Math.random() * entry.responses.length);
	return entry.responses[index];
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
