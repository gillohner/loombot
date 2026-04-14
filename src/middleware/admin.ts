// src/middleware/admin.ts
// Determines whether a user is an administrator for the current chat.
//
// Rules:
//  - If the user's Telegram id is listed in config.yaml `bot.admin_ids`, they
//    are admin everywhere (super-admin).
//  - In private chats: admin = !lock_dm_config (any DM user is admin of their
//    own DM unless the operator locked DMs).
//  - In groups/supergroups: Telegram chat administrators are admins of that chat.

import { getOperatorConfig } from "@core/config/runtime.ts";

export interface AdminCheckContextLike {
	chat?: { id: number | string; type: string };
	from?: { id: number };
	getChatAdministrators?: () => Promise<unknown[]>;
}

function getBotAdminIdSet(): Set<string> {
	try {
		const cfg = getOperatorConfig();
		return new Set(cfg.bot.admin_ids.map((x) => String(x)));
	} catch {
		return new Set();
	}
}

export async function userIsAdmin(ctx: AdminCheckContextLike): Promise<boolean> {
	const userId = ctx.from?.id;
	if (!userId) return false;
	const chat = ctx.chat;
	if (!chat) return false;

	const adminSet = getBotAdminIdSet();
	if (adminSet.has(String(userId))) return true;

	if (chat.type === "private") {
		try {
			return !getOperatorConfig().bot.lock_dm_config;
		} catch {
			return true;
		}
	}

	if (ctx.getChatAdministrators) {
		try {
			const admins = await ctx.getChatAdministrators();
			for (const m of admins) {
				const candidate = m as { user?: { id?: number } };
				if (candidate.user?.id === userId) return true;
			}
			return false;
		} catch {
			return false;
		}
	}
	return false;
}
