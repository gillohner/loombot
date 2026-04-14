// sdk/schema.ts
// JSON Schema types for service configuration and dataset validation.
// These schemas enable the web config builder to generate forms automatically.

/**
 * JSON Schema type definitions (subset of JSON Schema Draft 7)
 * Used for validating service configs and datasets.
 */
export interface JSONSchemaString {
	type: "string";
	title?: string;
	description?: string;
	default?: string;
	enum?: string[];
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	format?: "uri" | "email" | "date" | "date-time" | "uri-reference" | "textarea";
}

export interface JSONSchemaNumber {
	type: "number" | "integer";
	title?: string;
	description?: string;
	default?: number;
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	multipleOf?: number;
}

export interface JSONSchemaBoolean {
	type: "boolean";
	title?: string;
	description?: string;
	default?: boolean;
}

export interface JSONSchemaArray {
	type: "array";
	title?: string;
	description?: string;
	items?: JSONSchemaType;
	minItems?: number;
	maxItems?: number;
	uniqueItems?: boolean;
	default?: unknown[];
}

export interface JSONSchemaObject {
	type: "object";
	title?: string;
	description?: string;
	properties?: Record<string, JSONSchemaType>;
	required?: string[];
	additionalProperties?: boolean | JSONSchemaType;
	default?: Record<string, unknown>;
}

export interface JSONSchemaRef {
	$ref: string;
	title?: string;
	description?: string;
}

export interface JSONSchemaOneOf {
	oneOf: JSONSchemaType[];
	title?: string;
	description?: string;
}

export interface JSONSchemaAnyOf {
	anyOf: JSONSchemaType[];
	title?: string;
	description?: string;
}

export type JSONSchemaType =
	| JSONSchemaString
	| JSONSchemaNumber
	| JSONSchemaBoolean
	| JSONSchemaArray
	| JSONSchemaObject
	| JSONSchemaRef
	| JSONSchemaOneOf
	| JSONSchemaAnyOf;

/**
 * Root JSON Schema with optional metadata
 */
export interface JSONSchema extends JSONSchemaObject {
	$schema?: string;
	$id?: string;
	$defs?: Record<string, JSONSchemaType>;
}

/**
 * Dataset schema definition for a service.
 * Each key is a dataset name that can be provided in the service config.
 */
export interface DatasetSchemas {
	[datasetName: string]: {
		/** JSON Schema for validating the dataset */
		schema: JSONSchema;
		/** Human-readable description for config builder UI */
		description?: string;
		/** Whether this dataset is required */
		required?: boolean;
		/** Example data for documentation/testing */
		example?: unknown;
	};
}

/**
 * Service schema bundle - all schemas for a service
 */
export interface ServiceSchemas {
	/** Schema for the service's config object (the `config` field in bot_config.json) */
	configSchema?: JSONSchema;
	/** Schemas for each named dataset the service can consume */
	datasetSchemas?: DatasetSchemas;
}

/**
 * Validates data against a simple JSON schema.
 * This is a basic validator for runtime use - not a full JSON Schema validator.
 * For complex schemas, use a proper validator like Ajv.
 */
export function validateSchema(
	schema: JSONSchemaType,
	data: unknown,
	path = "",
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if ("$ref" in schema) {
		// Refs not supported in basic validator
		return { valid: true, errors: [] };
	}

	if ("oneOf" in schema || "anyOf" in schema) {
		const schemas = "oneOf" in schema ? schema.oneOf : schema.anyOf;
		const results = schemas.map((s) => validateSchema(s, data, path));
		const validCount = results.filter((r) => r.valid).length;
		if ("oneOf" in schema && validCount !== 1) {
			errors.push(`${path}: must match exactly one schema in oneOf`);
		} else if ("anyOf" in schema && validCount === 0) {
			errors.push(`${path}: must match at least one schema in anyOf`);
		}
		return { valid: errors.length === 0, errors };
	}

	const s = schema as
		| JSONSchemaString
		| JSONSchemaNumber
		| JSONSchemaBoolean
		| JSONSchemaArray
		| JSONSchemaObject;

	switch (s.type) {
		case "string":
			if (typeof data !== "string") {
				errors.push(`${path}: expected string, got ${typeof data}`);
			} else {
				if (s.minLength !== undefined && data.length < s.minLength) {
					errors.push(`${path}: string too short (min ${s.minLength})`);
				}
				if (s.maxLength !== undefined && data.length > s.maxLength) {
					errors.push(`${path}: string too long (max ${s.maxLength})`);
				}
				if (s.enum && !s.enum.includes(data)) {
					errors.push(`${path}: value must be one of: ${s.enum.join(", ")}`);
				}
				if (s.pattern && !new RegExp(s.pattern).test(data)) {
					errors.push(`${path}: string does not match pattern ${s.pattern}`);
				}
			}
			break;

		case "number":
		case "integer":
			if (typeof data !== "number") {
				errors.push(`${path}: expected number, got ${typeof data}`);
			} else {
				if (s.type === "integer" && !Number.isInteger(data)) {
					errors.push(`${path}: expected integer`);
				}
				if (s.minimum !== undefined && data < s.minimum) {
					errors.push(`${path}: value below minimum (${s.minimum})`);
				}
				if (s.maximum !== undefined && data > s.maximum) {
					errors.push(`${path}: value above maximum (${s.maximum})`);
				}
			}
			break;

		case "boolean":
			if (typeof data !== "boolean") {
				errors.push(`${path}: expected boolean, got ${typeof data}`);
			}
			break;

		case "array":
			if (!Array.isArray(data)) {
				errors.push(`${path}: expected array, got ${typeof data}`);
			} else {
				if (s.minItems !== undefined && data.length < s.minItems) {
					errors.push(`${path}: array too short (min ${s.minItems})`);
				}
				if (s.maxItems !== undefined && data.length > s.maxItems) {
					errors.push(`${path}: array too long (max ${s.maxItems})`);
				}
				if (s.items) {
					for (let i = 0; i < data.length; i++) {
						const itemResult = validateSchema(s.items, data[i], `${path}[${i}]`);
						errors.push(...itemResult.errors);
					}
				}
			}
			break;

		case "object":
			if (typeof data !== "object" || data === null || Array.isArray(data)) {
				errors.push(`${path}: expected object, got ${typeof data}`);
			} else {
				const obj = data as Record<string, unknown>;
				// Check required fields
				if (s.required) {
					for (const req of s.required) {
						if (!(req in obj)) {
							errors.push(`${path}.${req}: required field missing`);
						}
					}
				}
				// Validate properties
				if (s.properties) {
					for (const [key, propSchema] of Object.entries(s.properties)) {
						if (key in obj) {
							const propResult = validateSchema(propSchema, obj[key], `${path}.${key}`);
							errors.push(...propResult.errors);
						}
					}
				}
			}
			break;
	}

	return { valid: errors.length === 0, errors };
}

// Re-export for convenience
export type { JSONSchema as ServiceConfigSchema };

/**
 * Shared validation result types used by services that hand-roll config /
 * dataset validators (Zod can't run inside the sandboxed subprocess).
 * A service's `validateConfig()` / `validateDataset()` pushes `ValidationError`
 * entries and returns a `ValidationResult`.
 */
export interface ValidationError {
	path: string;
	message: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}
