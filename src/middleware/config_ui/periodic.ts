// src/middleware/config_ui/periodic.ts
// The "Periodic broadcast" view: per-chat control over the meetups periodic
// auto-broadcast. Every field is an override — omitted fields fall through to
// the operator default in config.yaml.

import type { Context } from "grammy";
import { getOperatorConfig } from "@core/config/runtime.ts";
import { getChatFeatureOverride, setChatFeatureOverride } from "@core/config/store.ts";
import { clearPendingInput, setPendingInput } from "@middleware/config_ui/state.ts";
import { runPeriodicNow } from "@core/scheduler/scheduler.ts";
import type { InlineKeyboard } from "@middleware/config_ui/types.ts";

const DEFAULT_ENABLED = false;
const DEFAULT_DAY = 1; // Monday
const DEFAULT_HOUR = 7;
const DEFAULT_TIMEZONE = "Europe/Zurich";
const DEFAULT_RANGE = "week";
const DEFAULT_PIN = true;
const DEFAULT_UNPIN_PREVIOUS = true;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

const RANGES: Array<{ id: string; label: string }> = [
	{ id: "today", label: "Today" },
	{ id: "week", label: "This week" },
	{ id: "2weeks", label: "Next 2 weeks" },
	{ id: "30days", label: "Next 30 days" },
];

interface PeriodicOverride {
	enabled?: boolean;
	day?: number;
	hour?: number;
	timezone?: string;
	range?: string;
	pin?: boolean;
	unpin_previous?: boolean;
}

interface EffectivePeriodic {
	enabled: boolean;
	day: number;
	hour: number;
	timezone: string;
	range: string;
	pin: boolean;
	unpinPrevious: boolean;
	isOverridden: {
		enabled: boolean;
		day: boolean;
		hour: boolean;
		timezone: boolean;
		range: boolean;
		pin: boolean;
		unpinPrevious: boolean;
	};
}

function getOperatorDefaults(featureId: string): {
	enabled: boolean;
	day: number;
	hour: number;
	timezone: string;
	range: string;
	pin: boolean;
	unpinPrevious: boolean;
} {
	const operator = getOperatorConfig();
	const feature = operator.features[featureId];
	const cfg = (feature?.config ?? {}) as Record<string, unknown>;
	return {
		enabled: typeof cfg.periodicEnabled === "boolean" ? cfg.periodicEnabled : DEFAULT_ENABLED,
		day: typeof cfg.periodicDay === "number" ? cfg.periodicDay : DEFAULT_DAY,
		hour: typeof cfg.periodicHour === "number" ? cfg.periodicHour : DEFAULT_HOUR,
		timezone: typeof cfg.periodicTimezone === "string" ? cfg.periodicTimezone : DEFAULT_TIMEZONE,
		range: typeof cfg.periodicRange === "string" ? cfg.periodicRange : DEFAULT_RANGE,
		pin: typeof cfg.periodicPin === "boolean" ? cfg.periodicPin : DEFAULT_PIN,
		unpinPrevious: typeof cfg.periodicUnpinPrevious === "boolean"
			? cfg.periodicUnpinPrevious
			: DEFAULT_UNPIN_PREVIOUS,
	};
}

function getPeriodicOverride(chatId: string, featureId: string): PeriodicOverride {
	const override = getChatFeatureOverride(chatId, featureId);
	const raw = override?.data?.periodic;
	if (raw && typeof raw === "object") return raw as PeriodicOverride;
	return {};
}

function getEffective(chatId: string, featureId: string): EffectivePeriodic {
	const defaults = getOperatorDefaults(featureId);
	const p = getPeriodicOverride(chatId, featureId);
	return {
		enabled: typeof p.enabled === "boolean" ? p.enabled : defaults.enabled,
		day: typeof p.day === "number" ? p.day : defaults.day,
		hour: typeof p.hour === "number" ? p.hour : defaults.hour,
		timezone: typeof p.timezone === "string" ? p.timezone : defaults.timezone,
		range: typeof p.range === "string" ? p.range : defaults.range,
		pin: typeof p.pin === "boolean" ? p.pin : defaults.pin,
		unpinPrevious: typeof p.unpin_previous === "boolean"
			? p.unpin_previous
			: defaults.unpinPrevious,
		isOverridden: {
			enabled: typeof p.enabled === "boolean",
			day: typeof p.day === "number",
			hour: typeof p.hour === "number",
			timezone: typeof p.timezone === "string",
			range: typeof p.range === "string",
			pin: typeof p.pin === "boolean",
			unpinPrevious: typeof p.unpin_previous === "boolean",
		},
	};
}

function setPeriodicFields(
	chatId: string,
	featureId: string,
	patch: PeriodicOverride,
): void {
	// Merge inside the `periodic` sub-object before calling setChatFeatureOverride,
	// because store.ts only shallow-merges the top-level `data` blob.
	const current = getPeriodicOverride(chatId, featureId);
	const next: PeriodicOverride = { ...current, ...patch };
	setChatFeatureOverride(chatId, featureId, {
		data: { periodic: next },
	});
}

function tag(isOverride: boolean): string {
	return isOverride ? "override" : "default";
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function rangeLabel(id: string): string {
	return RANGES.find((r) => r.id === id)?.label ?? id;
}

function pad2(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

export function periodicText(chatId: string, featureId: string): string {
	const eff = getEffective(chatId, featureId);
	const o = eff.isOverridden;
	const status = eff.enabled ? "✅ Enabled" : "❌ Disabled";
	const dayName = DAY_LONG[eff.day] ?? `day ${eff.day}`;
	const hourStr = `${pad2(eff.hour)}:00`;
	const tz = escapeHtml(eff.timezone);
	const range = rangeLabel(eff.range);
	const pinStr = eff.pin ? "✅" : "❌";
	const unpinStr = eff.unpinPrevious ? "✅" : "❌";

	return [
		`📣 <b>Periodic broadcast</b> — <code>${escapeHtml(featureId)}</code>`,
		"",
		`<b>Status:</b> ${status} <i>(${tag(o.enabled)})</i>`,
		`<b>Day:</b> ${dayName} <i>(${tag(o.day)})</i>`,
		`<b>Hour:</b> ${hourStr} <i>(${tag(o.hour)})</i>`,
		`<b>Timezone:</b> <code>${tz}</code> <i>(${tag(o.timezone)})</i>`,
		`<b>Range:</b> ${range} <i>(${tag(o.range)})</i>`,
		`<b>Pin message:</b> ${pinStr} <i>(${tag(o.pin)})</i>`,
		`<b>Unpin previous:</b> ${unpinStr} <i>(${tag(o.unpinPrevious)})</i>`,
		"",
		"Calendars for the broadcast are managed under <b>📅 Calendars</b>.",
		"Tap <b>🚀 Send preview now</b> to fire a one-off broadcast with the current settings.",
	].join("\n");
}

export function periodicKeyboard(chatId: string, featureId: string): InlineKeyboard {
	const eff = getEffective(chatId, featureId);
	const rows: InlineKeyboard = [];

	// Enabled toggle
	rows.push([{
		text: eff.enabled ? "✅ Enabled — tap to disable" : "❌ Disabled — tap to enable",
		callback_data: `cfg:per:tog:${featureId}`,
	}]);

	// Day row: Mon, Tue, ..., Sun (reordered from Sun-first to Mon-first for UI).
	const dayOrder = [1, 2, 3, 4, 5, 6, 0];
	rows.push(dayOrder.map((d) => ({
		text: d === eff.day ? `[${DAY_SHORT[d]}]` : ` ${DAY_SHORT[d]} `,
		callback_data: `cfg:per:day:${featureId}:${d}`,
	})));

	// Hour grid: 4 rows of 6 buttons.
	for (let r = 0; r < 4; r++) {
		const row: Array<{ text: string; callback_data: string }> = [];
		for (let c = 0; c < 6; c++) {
			const h = r * 6 + c;
			row.push({
				text: h === eff.hour ? `[${pad2(h)}]` : ` ${pad2(h)} `,
				callback_data: `cfg:per:hour:${featureId}:${h}`,
			});
		}
		rows.push(row);
	}

	// Range row
	rows.push(RANGES.map((r) => ({
		text: r.id === eff.range ? `✅ ${r.label}` : r.label,
		callback_data: `cfg:per:range:${featureId}:${r.id}`,
	})));

	// Timezone editor
	rows.push([{
		text: `🌍 ${eff.timezone} — change`,
		callback_data: `cfg:per:tz:${featureId}`,
	}]);

	// Pin / unpin toggles (side by side)
	rows.push([
		{
			text: `Pin ${eff.pin ? "✅" : "❌"}`,
			callback_data: `cfg:per:pin:${featureId}`,
		},
		{
			text: `Unpin previous ${eff.unpinPrevious ? "✅" : "❌"}`,
			callback_data: `cfg:per:unpin:${featureId}`,
		},
	]);

	// Preview
	rows.push([{
		text: "🚀 Send preview now",
		callback_data: `cfg:per:preview:${featureId}`,
	}]);

	// Calendars link + reset
	rows.push([
		{ text: "📅 Calendars", callback_data: `cfg:cals:${featureId}` },
		{ text: "🔄 Reset to defaults", callback_data: `cfg:per:reset:${featureId}` },
	]);

	rows.push([{ text: "← Back", callback_data: "cfg:main" }]);
	return rows;
}

export async function showPeriodic(
	ctx: Context,
	chatId: string,
	featureId: string,
): Promise<void> {
	try {
		await ctx.editMessageText(periodicText(chatId, featureId), {
			parse_mode: "HTML",
			reply_markup: { inline_keyboard: periodicKeyboard(chatId, featureId) },
		});
	} catch {
		// ignore edit failures (message too old, no change, etc.)
	}
}

export async function toggleEnabled(
	ctx: Context,
	chatId: string,
	featureId: string,
): Promise<void> {
	const eff = getEffective(chatId, featureId);
	setPeriodicFields(chatId, featureId, { enabled: !eff.enabled });
	await showPeriodic(ctx, chatId, featureId);
	await ctx.answerCallbackQuery({ text: !eff.enabled ? "Enabled" : "Disabled" });
}

export async function setDay(
	ctx: Context,
	chatId: string,
	featureId: string,
	day: number,
): Promise<void> {
	if (!Number.isInteger(day) || day < 0 || day > 6) {
		await ctx.answerCallbackQuery({ text: "Invalid day" });
		return;
	}
	setPeriodicFields(chatId, featureId, { day });
	await showPeriodic(ctx, chatId, featureId);
	await ctx.answerCallbackQuery({ text: DAY_LONG[day] });
}

export async function setHour(
	ctx: Context,
	chatId: string,
	featureId: string,
	hour: number,
): Promise<void> {
	if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
		await ctx.answerCallbackQuery({ text: "Invalid hour" });
		return;
	}
	setPeriodicFields(chatId, featureId, { hour });
	await showPeriodic(ctx, chatId, featureId);
	await ctx.answerCallbackQuery({ text: `${pad2(hour)}:00` });
}

export async function setRange(
	ctx: Context,
	chatId: string,
	featureId: string,
	range: string,
): Promise<void> {
	if (!RANGES.some((r) => r.id === range)) {
		await ctx.answerCallbackQuery({ text: "Invalid range" });
		return;
	}
	setPeriodicFields(chatId, featureId, { range });
	await showPeriodic(ctx, chatId, featureId);
	await ctx.answerCallbackQuery({ text: rangeLabel(range) });
}

export async function togglePin(
	ctx: Context,
	chatId: string,
	featureId: string,
): Promise<void> {
	const eff = getEffective(chatId, featureId);
	setPeriodicFields(chatId, featureId, { pin: !eff.pin });
	await showPeriodic(ctx, chatId, featureId);
	await ctx.answerCallbackQuery();
}

export async function toggleUnpinPrevious(
	ctx: Context,
	chatId: string,
	featureId: string,
): Promise<void> {
	const eff = getEffective(chatId, featureId);
	setPeriodicFields(chatId, featureId, { unpin_previous: !eff.unpinPrevious });
	await showPeriodic(ctx, chatId, featureId);
	await ctx.answerCallbackQuery();
}

export async function resetPeriodic(
	ctx: Context,
	chatId: string,
	featureId: string,
): Promise<void> {
	// Drop the whole `periodic` key from the override data while preserving
	// anything else (selected_calendar_ids, external_calendars, welcome_override, ...).
	// Setting the key to `undefined` lets JSON.stringify drop it on write.
	setChatFeatureOverride(chatId, featureId, {
		data: { periodic: undefined },
	});
	await showPeriodic(ctx, chatId, featureId);
	await ctx.answerCallbackQuery({ text: "Reset to operator defaults" });
}

export async function promptEditTimezone(
	ctx: Context,
	chatId: string,
	userId: string,
	featureId: string,
): Promise<void> {
	const menuMessageId = ctx.callbackQuery?.message?.message_id;
	setPendingInput(chatId, userId, {
		kind: "await_periodic_timezone",
		chatId,
		featureId,
		menuMessageId,
	});
	await ctx.answerCallbackQuery();
	await ctx.reply(
		[
			"🌍 <b>Send me an IANA timezone.</b>",
			"",
			"Examples: <code>Europe/Zurich</code>, <code>America/New_York</code>, <code>Pacific/Auckland</code>.",
			"",
			"Send /cancel to keep the current timezone.",
		].join("\n"),
		{ parse_mode: "HTML" },
	);
}

export async function handleTimezoneInput(
	ctx: Context,
	chatId: string,
	userId: string,
	text: string,
	featureId: string,
): Promise<void> {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		await ctx.reply(
			[
				"Timezone can't be empty.",
				"",
				"Send one like <code>Europe/Zurich</code>, or /cancel to keep the current timezone.",
			].join("\n"),
			{ parse_mode: "HTML" },
		);
		return;
	}
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
	} catch {
		await ctx.reply(
			[
				`<code>${escapeHtml(trimmed)}</code> isn't a valid IANA timezone.`,
				"",
				"Examples: <code>Europe/Zurich</code>, <code>America/New_York</code>, <code>Pacific/Auckland</code>.",
				"",
				"Send /cancel to keep the current timezone, or try again.",
			].join("\n"),
			{ parse_mode: "HTML" },
		);
		return;
	}
	setPeriodicFields(chatId, featureId, { timezone: trimmed });
	clearPendingInput(chatId, userId);
	await ctx.reply(`✅ Timezone set to <code>${escapeHtml(trimmed)}</code>.`, {
		parse_mode: "HTML",
	});
}

export async function triggerPreview(
	ctx: Context,
	chatId: string,
	_featureId: string,
): Promise<void> {
	try {
		await runPeriodicNow(chatId, ctx.api);
		await ctx.answerCallbackQuery({ text: "Preview sent" });
	} catch (err) {
		await ctx.answerCallbackQuery({
			text: `Preview failed: ${(err as Error).message}`.slice(0, 200),
			show_alert: true,
		});
	}
}
