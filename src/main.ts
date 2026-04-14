// src/main.ts
import { createBot } from "./bot.ts";
import { webhookCallback } from "grammy";
import { cleanupAll } from "@core/ttl/store.ts";
import { startScheduler } from "@core/scheduler/scheduler.ts";
import { log } from "@core/util/logger.ts";

async function startupTtlCleanup(
	api: { deleteMessage: (chatId: number, id: number) => Promise<unknown> },
) {
	try {
		const removed = await cleanupAll(async (m) => {
			if (m.platform === "telegram") {
				try {
					await api.deleteMessage(m.chatId as number, m.messageId);
				} catch (err) {
					log.debug("ttl.startup.delete.failed", { error: (err as Error).message });
				}
			}
		});
		if (removed) log.info("ttl.startup.cleaned", { removed });
	} catch (err) {
		log.warn("ttl.startup.cleanup.failed", { error: (err as Error).message });
	}
}

if (import.meta.main) {
	const bot = await createBot();
	const useWebhook = Deno.env.get("WEBHOOK") === "1";
	await startupTtlCleanup(bot.api);
	startScheduler(bot.api);
	if (useWebhook) {
		const handle = webhookCallback(bot, "std/http");
		Deno.serve((req) => {
			const url = new URL(req.url);
			if (req.method === "POST" && url.pathname === `/${bot.token}`) {
				return handle(req);
			}
			return new Response("OK");
		});
	} else {
		log.info("bot.starting", { mode: "polling" });
		await bot.start();
		log.info("bot.started", { mode: "polling" });
	}
}
