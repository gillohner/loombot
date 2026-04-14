// scripts/validate-config.ts
// Validates config.yaml against the schema without starting the bot.
// Usage: deno task config:check

import { loadOperatorConfig } from "@core/config/loader.ts";

const target = Deno.args[0] ?? Deno.env.get("CONFIG_FILE") ?? "./config.yaml";

try {
	const { config, sourcePath } = await loadOperatorConfig(target);
	const features = Object.keys(config.features);
	console.log(`✓ ${sourcePath} is valid`);
	console.log(`  pubky.enabled: ${config.pubky.enabled}`);
	console.log(`  bot.admin_ids: ${config.bot.admin_ids.length}`);
	console.log(`  features: ${features.length} (${features.join(", ")})`);
	Deno.exit(0);
} catch (err) {
	console.error(`✗ ${(err as Error).message}`);
	Deno.exit(1);
}
