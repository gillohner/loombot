// packages/core_services/simple-response/service_test.ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import type { CommandEvent, MessageEvent } from "@sdk/mod.ts";
import type { ServiceResponse } from "@sdk/mod.ts";
import service from "./service.ts";

// Helper to create a command event
function makeCommandEvent(config: Record<string, unknown> = {}): CommandEvent {
	return {
		type: "command",
		chatId: "12345",
		userId: "67890",
		serviceConfig: config,
	} as CommandEvent;
}

// Helper to create a message event
function makeMessageEvent(text: string): MessageEvent {
	return {
		type: "message",
		chatId: "12345",
		userId: "67890",
		message: { text },
	} as MessageEvent;
}

// Service tests
Deno.test("should respond with default message", () => {
	const ev = makeCommandEvent();
	const result = service.handlers.command(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertStringIncludes(result.text!, "Hello");
	}
});

Deno.test("should respond with custom message from config", () => {
	const ev = makeCommandEvent({ message: "This is a custom help message!" });
	const result = service.handlers.command(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertEquals(result.text!, "This is a custom help message!");
	}
});

Deno.test("should always use HTML parse mode", () => {
	const ev = makeCommandEvent({
		message: "<b>Bold HTML</b>",
	});
	const result = service.handlers.command(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertEquals(result.options?.parse_mode, "HTML");
	}
});

Deno.test("should respect disableLinkPreview config", () => {
	const ev = makeCommandEvent({
		message: "Check out https://example.com",
		disableLinkPreview: true,
	});
	const result = service.handlers.command(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertEquals(result.options?.disable_web_page_preview, true);
	}
});

Deno.test("should return none for message events", () => {
	const ev = makeMessageEvent("Hello");
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "none");
});

Deno.test("should have correct service metadata", () => {
	assertEquals(service.id, "simple_response");
	assertEquals(service.kind, "single_command");
});

Deno.test("should have config schema defined", () => {
	assertEquals(service.configSchema !== undefined, true);
	assertEquals(service.configSchema?.type, "object");
});
