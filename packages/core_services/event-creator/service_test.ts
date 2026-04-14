// packages/core_services/event-creator/service_test.ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import type { CallbackEvent, CommandEvent, MessageEvent } from "@sdk/mod.ts";
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

// Helper to create a message event with state
function makeMessageEvent(
	text: string,
	state: Record<string, unknown> = {},
): MessageEvent {
	return {
		type: "message",
		chatId: "12345",
		userId: "67890",
		message: { text },
		state,
	} as MessageEvent;
}

// Helper to create a callback event
function makeCallbackEvent(
	data: string,
	state: Record<string, unknown> = {},
	config: Record<string, unknown> = {},
): CallbackEvent {
	return {
		type: "callback",
		chatId: "12345",
		userId: "67890",
		data,
		state,
		serviceConfig: config,
	} as CallbackEvent;
}

// Service metadata tests
Deno.test("should have correct service metadata", () => {
	assertEquals(service.id, "event_creator");
	assertEquals(service.kind, "command_flow");
	assertEquals(service.version, "2.0.0");
});

Deno.test("should have config schema defined", () => {
	assertEquals(service.configSchema !== undefined, true);
	assertEquals(service.configSchema?.type, "object");
});

Deno.test("should have dataset schemas defined", () => {
	assertEquals(service.datasetSchemas !== undefined, true);
});

// Command handler tests
Deno.test("command handler should start required phase with title prompt", () => {
	const ev = makeCommandEvent();
	const result = service.handlers.command(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertStringIncludes(result.text!, "Create a New Event");
		assertStringIncludes(result.text!, "Step 1/3");
	}
});

// Message handler tests
Deno.test("message handler should reply with phase prompt when in required phase", () => {
	const ev = makeMessageEvent("My Event Title", {
		phase: "required",
		requirementStep: 1,
	});
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertStringIncludes(result.text!, "Step 2/3");
	}
});

Deno.test("message handler should prompt to use command when no phase", () => {
	const ev = makeMessageEvent("random text");
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertStringIncludes(result.text!, "/newevent");
	}
});

// Callback handler tests
Deno.test("callback handler should route menu:cancel to cancel", () => {
	const ev = makeCallbackEvent("menu:cancel", {
		phase: "optional_menu",
		title: "Test",
		startDate: "2026-06-15",
		startTime: "18:00",
	});
	const result = service.handlers.callback(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertStringIncludes(result.text!, "cancelled");
	}
});

Deno.test("callback handler should handle unknown action", () => {
	const ev = makeCallbackEvent("unknown:action");
	const result = service.handlers.callback(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
});
