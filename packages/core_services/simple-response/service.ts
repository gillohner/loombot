// packages/core_services/simple-response/service.ts
// Simple Response - Single command service that responds with a configured message
import { defineService, none, reply, runService } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
	DEFAULT_CONFIG,
	SIMPLE_RESPONSE_CONFIG_SCHEMA,
	SIMPLE_RESPONSE_DATASET_SCHEMAS,
	SIMPLE_RESPONSE_SERVICE_ID,
	SIMPLE_RESPONSE_VERSION,
	type SimpleResponseConfig,
	validateConfig,
} from "./constants.ts";

// ============================================================================
// Service Definition
// ============================================================================

const service = defineService({
	id: SIMPLE_RESPONSE_SERVICE_ID,
	version: SIMPLE_RESPONSE_VERSION,
	kind: "single_command",
	description: "Responds with a configured message when a command is invoked",
	configSchema: SIMPLE_RESPONSE_CONFIG_SCHEMA,
	datasetSchemas: SIMPLE_RESPONSE_DATASET_SCHEMAS,
	handlers: {
		command: (ev: CommandEvent) => {
			// Get config with defaults
			const rawConfig = ev.serviceConfig || {};
			const configValidation = validateConfig(rawConfig);
			if (!configValidation.valid) {
				console.error("Simple Response config validation errors:", configValidation.errors);
			}
			const config: SimpleResponseConfig = { ...DEFAULT_CONFIG, ...rawConfig };

			return reply(config.message, {
				options: {
					parse_mode: "HTML",
					disable_web_page_preview: config.disableLinkPreview ?? true,
				},
			});
		},
		callback: (_ev: CallbackEvent) => none(),
		message: (_ev: MessageEvent) => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
