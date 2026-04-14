// packages/core_services/triggerwords/service_test.ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import type { MessageEvent } from "@sdk/mod.ts";
import type { ServiceResponse } from "@sdk/mod.ts";
import service from "./service.ts";
import { findMatchingEntry, pickRandomResponse, type TriggerEntry } from "./constants.ts";

// Helper to create a message event
function makeMessageEvent(
	text: string,
	options: {
		serviceConfig?: Record<string, unknown>;
		datasets?: Record<string, unknown>;
	} = {},
): MessageEvent {
	return {
		type: "message",
		chatId: "12345",
		userId: "67890",
		message: { text, message_id: 1 },
		serviceConfig: options.serviceConfig,
		datasets: options.datasets,
	} as MessageEvent;
}

// Helper tests
Deno.test("findMatchingEntry matches whole words", () => {
	const entries: TriggerEntry[] = [
		{ triggers: ["eth"], responses: ["Response 1"], matchMode: "word" },
	];

	// Should match "eth" as whole word
	assertEquals(findMatchingEntry("What is eth?", entries) !== null, true);

	// Should NOT match "ethereum" (eth is part of the word)
	assertEquals(findMatchingEntry("What is ethereum?", entries), null);
});

Deno.test("findMatchingEntry matches contains mode", () => {
	const entries: TriggerEntry[] = [
		{ triggers: ["eth"], responses: ["Response 1"], matchMode: "contains" },
	];

	// Should match "eth" anywhere
	assertEquals(findMatchingEntry("What is ethereum?", entries) !== null, true);
	assertEquals(findMatchingEntry("ETH is cool", entries) !== null, true);
});

Deno.test("findMatchingEntry is case-insensitive", () => {
	const entries: TriggerEntry[] = [
		{ triggers: ["Bitcoin"], responses: ["Response 1"], matchMode: "word" },
	];

	assertEquals(findMatchingEntry("BITCOIN is here", entries) !== null, true);
	assertEquals(findMatchingEntry("bitcoin rocks", entries) !== null, true);
	assertEquals(findMatchingEntry("BiTcOiN", entries) !== null, true);
});

Deno.test("findMatchingEntry skips disabled entries", () => {
	const entries: TriggerEntry[] = [
		{ triggers: ["test"], responses: ["Response 1"], enabled: false },
	];

	assertEquals(findMatchingEntry("this is a test", entries), null);
});

Deno.test("pickRandomResponse returns a response from the entry", () => {
	const entry: TriggerEntry = {
		triggers: ["test"],
		responses: ["A", "B", "C"],
	};

	const response = pickRandomResponse(entry);
	assertEquals(["A", "B", "C"].includes(response), true);
});

// Service tests
Deno.test("should return none for messages without trigger words", () => {
	const ev = makeMessageEvent("Hello, how are you?");
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "none");
});

Deno.test("should return none for empty messages", () => {
	const ev = makeMessageEvent("");
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "none");
});

Deno.test("should respond to default trigger word 'ethereum'", () => {
	const ev = makeMessageEvent("What do you think about ethereum?");
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
});

Deno.test("should respond to default trigger word 'btc'", () => {
	const ev = makeMessageEvent("I just bought some BTC!");
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
});

Deno.test("should use custom dataset", () => {
	const ev = makeMessageEvent("I love pizza!", {
		datasets: {
			triggers: {
				version: "1.0.0",
				entries: [
					{
						triggers: ["pizza"],
						responses: ["🍕 Pizza is the best!"],
						enabled: true,
					},
				],
			},
		},
	});
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertStringIncludes(result.text!, "Pizza is the best");
	}
});

Deno.test("should always use HTML parse mode", () => {
	const ev = makeMessageEvent("ethereum");
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertEquals(result.options?.parse_mode, "HTML");
	}
});

Deno.test("should handle responseProbability of 0", () => {
	// With probability 0, should never respond
	const ev = makeMessageEvent("ethereum", {
		serviceConfig: { responseProbability: 0 },
	});
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "none");
});

Deno.test("should have correct service metadata", () => {
	assertEquals(service.id, "triggerwords");
	assertEquals(service.kind, "listener");
});

Deno.test("should have dataset schemas defined", () => {
	assertEquals(service.datasetSchemas !== undefined, true);
	assertEquals(service.datasetSchemas?.triggers !== undefined, true);
});
