// packages/core_services/event-creator/utils/formatting.ts
// Date/time and URL formatting utilities

import { EVENTKY_APP_BASE } from "../constants.ts";
export { escapeHtml } from "@sdk/mod.ts";

/**
 * Format DD.MM.YYYY date and HH:MM time into ISO datetime string.
 * Example: formatDateTime("11.04.2026", "18:00") => "2026-04-11T18:00:00"
 */
export function formatDateTime(date: string, time: string): string {
	const parts = date.split(/[.\/-]/);
	if (parts.length === 3 && parts[2].length === 4) {
		// DD.MM.YYYY -> YYYY-MM-DD
		const dd = parts[0].padStart(2, "0");
		const mm = parts[1].padStart(2, "0");
		return `${parts[2]}-${mm}-${dd}T${time}:00`;
	}
	// Fallback for already-ISO dates
	return `${date}T${time}:00`;
}

/**
 * Build eventky.app URL for a specific event
 * Format: https://eventky.app/event/{userId}/{eventId}
 */
export function buildEventUrl(
	userId: string,
	eventId: string,
): string {
	return `${EVENTKY_APP_BASE}/event/${userId}/${eventId}`;
}

/**
 * Apply template variable replacements
 * Supported variables: {url}, {title}, {date}, {time}
 */
export function applyTemplate(
	template: string,
	vars: {
		url: string;
		title: string;
		date: string;
		time: string;
	},
): string {
	return template
		.replace(/{url}/g, vars.url)
		.replace(/{title}/g, vars.title)
		.replace(/{date}/g, vars.date)
		.replace(/{time}/g, vars.time);
}

/**
 * Truncate text for display
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength - 3) + "...";
}

/**
 * Format a date for display. Accepts DD.MM.YYYY and returns it as-is
 * (already human-friendly). Falls back to locale formatting for ISO dates.
 */
export function formatDateDisplay(date: string): string {
	// If already DD.MM.YYYY, return as-is
	if (/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}$/.test(date)) {
		return date;
	}
	// Fallback for ISO dates
	const d = new Date(date);
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}
