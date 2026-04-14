// src/core/state/state.ts
// Ephemeral in-memory state store for command_flow style services.
// Keyed by chatId + userId + serviceId. Intentionally SIMPLE: in-memory only.
// There is no pluggable backend anymore (per project decision) to reduce
// complexity; any persistence would require an explicit future redesign.

export interface StoredState {
	version: number;
	value: Record<string, unknown>;
}

interface KeyParts {
	chatId: string;
	userId: string;
	serviceId: string;
}
function key(p: KeyParts): string {
	return `${p.chatId}::${p.userId}::${p.serviceId}`;
}

const DATA = new Map<string, StoredState>();
// Active flow sessions are tracked per (chatId,userId) so multiple users in the
// same group chat can concurrently progress through independent command_flow services.
// Key format: `${chatId}::${userId}`
export interface FlowSession {
	serviceId: string;
	userId: string;
	since: number; // epoch ms when session became active
	ttlMs?: number; // optional time-to-live; if expired, session is invalid
}
const ACTIVE_FLOW = new Map<string, FlowSession>();

export function getServiceState(p: KeyParts): StoredState | undefined {
	return DATA.get(key(p));
}

export function setServiceState(
	p: KeyParts,
	value: Record<string, unknown>,
	version?: number,
): void {
	const current = DATA.get(key(p));
	const nextVersion = typeof version === "number" ? version : (current?.version ?? 0) + 1;
	const record: StoredState = { version: nextVersion, value };
	DATA.set(key(p), record);
}

export function clearServiceState(p: KeyParts): void {
	DATA.delete(key(p));
}

export interface ApplyParams extends KeyParts {
	directive: import("@sdk/mod.ts").StateDirective;
}

export function applyStateDirective(p: ApplyParams): StoredState | undefined {
	const existing = getServiceState(p);
	switch (p.directive.op) {
		case "clear":
			clearServiceState(p);
			return undefined;
		case "replace":
			setServiceState(p, p.directive.value, (existing?.version ?? 0) + 1);
			return getServiceState(p);
		case "merge": {
			const merged = { ...(existing?.value ?? {}), ...p.directive.value };
			setServiceState(p, merged, (existing?.version ?? 0) + 1);
			return getServiceState(p);
		}
	}
	return existing; // exhaustive for now
}

// Active flow helpers -------------------------------------------------------
function flowKey(chatId: string, userId: string): string {
	return `${chatId}::${userId}`;
}

export function setActiveFlow(
	chatId: string,
	userId: string,
	serviceId: string,
	opts?: { ttlMs?: number },
) {
	ACTIVE_FLOW.set(flowKey(chatId, userId), {
		serviceId,
		userId,
		since: Date.now(),
		ttlMs: opts?.ttlMs,
	});
}

export function clearActiveFlow(chatId: string, userId: string) {
	ACTIVE_FLOW.delete(flowKey(chatId, userId));
}

export function getActiveFlow(
	chatId: string,
	userId: string,
): FlowSession | undefined {
	const fs = ACTIVE_FLOW.get(flowKey(chatId, userId));
	if (!fs) return undefined;
	if (fs.ttlMs && Date.now() - fs.since > fs.ttlMs) {
		ACTIVE_FLOW.delete(flowKey(chatId, userId));
		return undefined;
	}
	return fs;
}

export function isActiveFlow(
	chatId: string,
	userId: string,
	serviceId: string,
): boolean {
	const cur = ACTIVE_FLOW.get(flowKey(chatId, userId));
	return !!cur && cur.serviceId === serviceId;
}

// Sweep expired flow sessions; returns number removed
export function sweepExpiredFlows(): number {
	let removed = 0;
	const now = Date.now();
	for (const [k, v] of ACTIVE_FLOW.entries()) {
		if (v.ttlMs && now - v.since > v.ttlMs) {
			ACTIVE_FLOW.delete(k);
			removed++;
		}
	}
	return removed;
}
