// packages/core_services/links/service.ts
// Links - Command flow service that displays categorized links with inline keyboard navigation
import { defineService, del, none, runService, state, UIBuilder, uiKeyboard } from "@sdk/mod.ts";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
import {
	DEFAULT_CONFIG,
	getCategories,
	LINKS_COMMAND,
	LINKS_CONFIG_SCHEMA,
	LINKS_DATASET_SCHEMAS,
	LINKS_REPLACE_GROUP,
	LINKS_SERVICE_ID,
	LINKS_VERSION,
	type LinksConfig,
	renderCategory,
} from "./constants.ts";

// ============================================================================
// Helpers
// ============================================================================

function buildCategoryKeyboard(categories: { name: string }[], serviceId: string) {
	const keyboard = UIBuilder.keyboard().namespace(serviceId);
	for (const [idx, category] of categories.entries()) {
		keyboard.callback(category.name, `c:${idx}`);
		keyboard.row();
	}
	keyboard.callback("\u2716 Close", "close");
	return keyboard.build();
}

// ============================================================================
// Service Definition
// ============================================================================

const service = defineService({
	id: LINKS_SERVICE_ID,
	version: LINKS_VERSION,
	kind: "command_flow",
	command: LINKS_COMMAND,
	description: "Display categorized links with inline keyboard navigation",
	configSchema: LINKS_CONFIG_SCHEMA,
	datasetSchemas: LINKS_DATASET_SCHEMAS,
	handlers: {
		command: (ev: CommandEvent) => {
			const rawConfig = ev.serviceConfig || {};
			const config: LinksConfig = { ...DEFAULT_CONFIG, ...rawConfig };
			const categories = getCategories(ev.datasets);
			const kb = buildCategoryKeyboard(categories, LINKS_SERVICE_ID);

			return uiKeyboard(kb, config.title || "Select a category:", {
				state: state.replace({ active: true }),
				options: {
					parse_mode: "HTML",
					replaceGroup: LINKS_REPLACE_GROUP,
					disable_web_page_preview: config.disableLinkPreview ?? true,
				},
			});
		},
		callback: (ev: CallbackEvent) => {
			const data = ev.data;

			if (data === "close") {
				return del();
			}

			const match = /^c:(\d+)/.exec(data);
			if (!match) return none();

			const rawConfig = ev.serviceConfig || {};
			const config: LinksConfig = { ...DEFAULT_CONFIG, ...rawConfig };
			const idx = Number(match[1]);
			const categories = getCategories(ev.datasets);
			const text = renderCategory(categories, idx);
			const kb = buildCategoryKeyboard(categories, LINKS_SERVICE_ID);

			return uiKeyboard(kb, text, {
				state: state.replace({ active: true }),
				options: {
					parse_mode: "HTML",
					replaceGroup: LINKS_REPLACE_GROUP,
					disable_web_page_preview: config.disableLinkPreview ?? true,
				},
			});
		},
		message: (_ev: MessageEvent) => none(),
	},
});

export default service;
if (import.meta.main) await runService(service);
