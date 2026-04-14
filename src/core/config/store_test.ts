// src/core/config/store_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
	closeDb,
	deleteSnapshotByConfigHash,
	initDb,
	listKnownChatIds,
	loadSnapshotByConfigHash,
	rememberChat,
	saveSnapshotByConfigHash,
} from "@core/config/store.ts";
import type { RoutingSnapshot } from "@schema/routing.ts";

Deno.test("snapshot save/load/delete by config hash", () => {
	initDb(":memory:");
	const hash = "cfg-deadbeef";
	const snap: RoutingSnapshot = {
		commands: {},
		listeners: [],
		builtAt: Date.now(),
		version: 1,
	};
	saveSnapshotByConfigHash(hash, snap);
	const rec = loadSnapshotByConfigHash(hash);
	assert(rec);
	const parsed = JSON.parse(rec!.snapshot_json) as RoutingSnapshot;
	assertEquals(parsed.version, 1);
	// Delete and ensure gone
	deleteSnapshotByConfigHash(hash);
	const missing = loadSnapshotByConfigHash(hash);
	assertEquals(missing, undefined);
	closeDb();
});

Deno.test("deleteSnapshotByConfigHash no-op on unknown hash", () => {
	initDb(":memory:");
	deleteSnapshotByConfigHash("nonexistent-hash");
	// nothing to assert besides no throw
	closeDb();
});

Deno.test("rememberChat makes a chat visible to listKnownChatIds", () => {
	initDb(":memory:");
	assertEquals(listKnownChatIds(), []);

	rememberChat("chat-123");
	rememberChat("chat-456");
	// idempotent — second call must not duplicate
	rememberChat("chat-123");

	const known = listKnownChatIds().sort();
	assertEquals(known, ["chat-123", "chat-456"]);
	closeDb();
});

Deno.test("rememberChat noop on empty chat id", () => {
	initDb(":memory:");
	rememberChat("");
	assertEquals(listKnownChatIds(), []);
	closeDb();
});
