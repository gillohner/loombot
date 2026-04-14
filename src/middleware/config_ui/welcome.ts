// src/middleware/config_ui/welcome.ts
// The "Welcome message" view: edit or reset the new_member welcome text for
// this chat.

import type { Context } from "grammy";
import { getOperatorConfig } from "@core/config/runtime.ts";
import { getChatFeatureOverride, setChatFeatureOverride } from "@core/config/store.ts";
import { clearPendingInput, setPendingInput } from "@middleware/config_ui/state.ts";
import type { InlineKeyboard } from "@middleware/config_ui/types.ts";

function currentWelcome(chatId: string, featureId: string): {
	effective: string;
	isOverride: boolean;
	defaultMessage: string;
} {
	const operator = getOperatorConfig();
	const feature = operator.features[featureId];
	const defaultMessage = (feature?.config?.message as string) ?? "";
	const override = getChatFeatureOverride(chatId, featureId);
	const custom = override?.data?.welcome_override;
	if (typeof custom === "string" && custom.length > 0) {
		return { effective: custom, isOverride: true, defaultMessage };
	}
	return { effective: defaultMessage, isOverride: false, defaultMessage };
}

export function welcomeText(chatId: string, featureId: string): string {
	const { effective, isOverride, defaultMessage } = currentWelcome(chatId, featureId);
	const escaped = escapeHtml(effective);
	const state = isOverride ? "Custom (chat override)" : "Using operator default";
	return `👋 <b>Welcome message</b>\n\n<b>Status:</b> ${state}\n\n<pre>${escaped}</pre>\n\n` +
		(isOverride
			? `(Default: <pre>${escapeHtml(defaultMessage)}</pre>)`
			: "Tap <i>Edit</i> to override the default in this chat.");
}

export function welcomeKeyboard(
	chatId: string,
	featureId: string,
): InlineKeyboard {
	const { isOverride } = currentWelcome(chatId, featureId);
	const rows: InlineKeyboard = [
		[{ text: "✏️ Edit", callback_data: `cfg:welcome_edit:${featureId}` }],
	];
	if (isOverride) {
		rows.push([{ text: "♻️ Reset to default", callback_data: `cfg:welcome_reset:${featureId}` }]);
	}
	rows.push([{ text: "← Back", callback_data: "cfg:main" }]);
	return rows;
}

export async function showWelcome(
	ctx: Context,
	chatId: string,
	featureId: string,
): Promise<void> {
	try {
		await ctx.editMessageText(welcomeText(chatId, featureId), {
			parse_mode: "HTML",
			reply_markup: { inline_keyboard: welcomeKeyboard(chatId, featureId) },
		});
	} catch {
		// ignore
	}
}

export async function promptEditWelcome(
	ctx: Context,
	chatId: string,
	userId: string,
	featureId: string,
): Promise<void> {
	const menuMessageId = ctx.callbackQuery?.message?.message_id;
	setPendingInput(chatId, userId, {
		kind: "await_welcome_message",
		chatId,
		featureId,
		menuMessageId,
	});
	await ctx.answerCallbackQuery();
	await ctx.reply(
		"Send me the new welcome message. You can use <code>{display_name}</code>, " +
			"<code>{username}</code>, <code>{first_name}</code>, <code>{last_name}</code>, " +
			"<code>{user_id}</code>. Send /cancel to abort.",
		{ parse_mode: "HTML" },
	);
}

export async function resetWelcome(
	ctx: Context,
	chatId: string,
	featureId: string,
): Promise<void> {
	setChatFeatureOverride(chatId, featureId, {
		data: { welcome_override: undefined },
	});
	await showWelcome(ctx, chatId, featureId);
	await ctx.answerCallbackQuery({ text: "Reset to default" });
}

export async function handleWelcomeInput(
	ctx: Context,
	chatId: string,
	userId: string,
	text: string,
	featureId: string,
): Promise<void> {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		await ctx.reply("Welcome message can't be empty. Try again or send /cancel.");
		return;
	}
	if (trimmed.length > 2000) {
		await ctx.reply("Too long (max 2000 chars). Try again or send /cancel.");
		return;
	}
	setChatFeatureOverride(chatId, featureId, {
		data: { welcome_override: trimmed },
	});
	clearPendingInput(chatId, userId);
	await ctx.reply("Welcome message updated. Tap /config to review.");
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
