// packages/core_services/simple-response/constants.ts
// Simple Response - Single command service that responds with a configured message

import type { DatasetSchemas, JSONSchema, ValidationError, ValidationResult } from "@sdk/mod.ts";
export type { ValidationError, ValidationResult };

// ============================================================================
// Service Identity
// ============================================================================

export const SIMPLE_RESPONSE_SERVICE_ID = "simple_response" as const;
export const SIMPLE_RESPONSE_VERSION = "1.0.0" as const;

// ============================================================================
// Types
// ============================================================================

export interface SimpleResponseConfig {
	/** The response message to send (supports HTML tags) */
	message: string;
	/** Whether to disable link previews (default: false) */
	disableLinkPreview?: boolean;
}

// ============================================================================
// JSON Schemas
// ============================================================================

export const SIMPLE_RESPONSE_CONFIG_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		message: {
			type: "string",
			description: "The response message to send when the command is invoked (supports HTML tags)",
			format: "textarea",
			maxLength: 4000,
		},
		disableLinkPreview: {
			type: "boolean",
			title: "Disable Link Preview",
			description: "Disable URL previews in messages (Telegram only renders the first URL preview)",
			default: true,
		},
		messageTtl: {
			type: "integer",
			title: "Message TTL",
			description: "Auto-delete bot messages after this many seconds (0 to keep forever)",
			minimum: 0,
			default: 300,
		},
	},
	required: ["message"],
};

export const SIMPLE_RESPONSE_DATASET_SCHEMAS: DatasetSchemas = {};

// ============================================================================
// Validation Functions
// ============================================================================

export function validateConfig(data: unknown): ValidationResult {
	const errors: ValidationError[] = [];

	if (typeof data !== "object" || data === null) {
		errors.push({ path: "", message: "Config must be an object" });
		return { valid: false, errors };
	}

	const config = data as Record<string, unknown>;

	if (typeof config.message !== "string") {
		errors.push({ path: "message", message: "message is required and must be a string" });
	} else if (config.message.trim().length === 0) {
		errors.push({ path: "message", message: "message cannot be empty" });
	}

	if (config.disableLinkPreview !== undefined && typeof config.disableLinkPreview !== "boolean") {
		errors.push({ path: "disableLinkPreview", message: "disableLinkPreview must be a boolean" });
	}

	return { valid: errors.length === 0, errors };
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIG: SimpleResponseConfig = {
	message: "Hello! This is a simple response.",
	disableLinkPreview: true,
};
