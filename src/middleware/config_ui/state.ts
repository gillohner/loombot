// src/middleware/config_ui/state.ts
// In-memory tracking of users mid-way through a freeform /config sub-flow
// (typing a calendar URI, a welcome message, etc.). Lost on restart — which
// is fine, users just re-tap the menu button.

export type InputStep =
	| {
		kind: "await_external_calendar_uri";
		chatId: string;
		featureId: string;
		menuMessageId?: number;
	}
	| { kind: "await_welcome_message"; chatId: string; featureId: string; menuMessageId?: number }
	| {
		kind: "await_periodic_timezone";
		chatId: string;
		featureId: string;
		menuMessageId?: number;
	};

const pending = new Map<string, InputStep>();

function key(chatId: string, userId: string): string {
	return `${chatId}:${userId}`;
}

export function setPendingInput(chatId: string, userId: string, step: InputStep): void {
	pending.set(key(chatId, userId), step);
}

export function getPendingInput(chatId: string, userId: string): InputStep | undefined {
	return pending.get(key(chatId, userId));
}

export function clearPendingInput(chatId: string, userId: string): void {
	pending.delete(key(chatId, userId));
}

export function hasPendingInput(chatId: string, userId: string): boolean {
	return pending.has(key(chatId, userId));
}
