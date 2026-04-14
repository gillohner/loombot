// src/core/pubky/calendar_meta.ts
// Fetch calendar metadata (name, description) from a Pubky homeserver. Used by
// the /config inline menu to show human-friendly labels when a chat admin
// adds an external calendar by URI, and to validate that the URI resolves.

export interface CalendarMeta {
	uri: string;
	name?: string;
	description?: string;
}

/**
 * Normalize a calendar URI to the spec format:
 *   pubky://<authorId>/pub/eventky.app/calendars/<calendarId>
 */
export function normalizeCalendarUri(uri: string): string {
	if (!uri.startsWith("pubky://")) return uri;
	const rest = uri.slice("pubky://".length);
	if (/^[a-z0-9]{52}\/pub\/eventky\.app\/calendars\/[A-Z0-9]+$/.test(rest)) return uri;
	const malformed = rest.match(
		/^pub\/eventky\.app\/calendars?\/([a-z0-9]{52})\/([A-Z0-9]+)$/,
	);
	if (malformed) {
		return `pubky://${malformed[1]}/pub/eventky.app/calendars/${malformed[2]}`;
	}
	return uri;
}

export function isValidCalendarUri(uri: string): boolean {
	if (!uri.startsWith("pubky://")) return false;
	const rest = uri.slice("pubky://".length);
	return /^[a-z0-9]{52}\/pub\/eventky\.app\/calendars\/[A-Z0-9]+$/.test(rest);
}

/**
 * Fetch a calendar's metadata from its Pubky homeserver. Returns undefined
 * if the URI is unreachable or malformed. The import of the SDK is dynamic so
 * that bots running with `pubky.enabled: false` never pull in the Pubky module.
 */
export async function fetchCalendarMeta(uri: string): Promise<CalendarMeta | undefined> {
	const normalized = normalizeCalendarUri(uri);
	if (!isValidCalendarUri(normalized)) return undefined;
	try {
		const { Pubky } = await import("@synonymdev/pubky");
		const pubky = new Pubky();
		const address = normalized as `pubky://${string}/pub/${string}`;
		const data = await pubky.publicStorage.getJson(address) as Record<string, unknown> | null;
		if (!data || typeof data !== "object") return { uri: normalized };
		const name = typeof data.name === "string" ? data.name : undefined;
		const description = typeof data.description === "string" ? data.description : undefined;
		return { uri: normalized, name, description };
	} catch {
		return undefined;
	}
}
