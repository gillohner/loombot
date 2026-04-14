// packages/core_services/new-member/service_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import type { MessageEvent } from "@sdk/mod.ts";
import type { ServiceResponse } from "@sdk/mod.ts";
import service from "./service.ts";
import { formatWelcomeMessage } from "./constants.ts";

// Helper to create a message event with new members
function makeNewMemberEvent(
	newMembers: Array<{
		id: number;
		username?: string;
		first_name?: string;
		last_name?: string;
		is_bot?: boolean;
	}>,
	config: Record<string, unknown> = {},
): MessageEvent {
	return {
		type: "message",
		chatId: "12345",
		userId: "67890",
		message: { new_chat_members: newMembers },
		serviceConfig: config,
	} as MessageEvent;
}

// Helper to create a regular message event
function makeTextEvent(text: string): MessageEvent {
	return {
		type: "message",
		chatId: "12345",
		userId: "67890",
		message: { text },
	} as MessageEvent;
}

// Format helper tests
Deno.test("formatWelcomeMessage replaces all placeholders", () => {
	const template = "Welcome {display_name}! Your username is {username}, ID: {user_id}";
	const user = { id: 123, username: "testuser", firstName: "John", lastName: "Doe" };

	const result = formatWelcomeMessage(template, user, true);
	assertEquals(result, "Welcome @testuser! Your username is testuser, ID: 123");
});

Deno.test("formatWelcomeMessage uses display name without mention", () => {
	const template = "Welcome {display_name}!";
	const user = { id: 123, username: "testuser", firstName: "John", lastName: "Doe" };

	const result = formatWelcomeMessage(template, user, false);
	assertEquals(result, "Welcome John Doe!");
});

Deno.test("formatWelcomeMessage handles missing username", () => {
	const template = "Welcome {display_name}!";
	const user = { id: 123, firstName: "John" };

	const result = formatWelcomeMessage(template, user, true);
	assertEquals(result, "Welcome John!");
});

Deno.test("formatWelcomeMessage falls back to user ID", () => {
	const template = "Welcome {display_name}!";
	const user = { id: 123 };

	const result = formatWelcomeMessage(template, user, false);
	assertEquals(result, "Welcome User 123!");
});

// Service tests
Deno.test("should return none for regular text messages", () => {
	const ev = makeTextEvent("Hello world");
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "none");
});

Deno.test("should return none for empty new_chat_members", () => {
	const ev = makeNewMemberEvent([]);
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "none");
});

Deno.test("should return none when only bots join", () => {
	const ev = makeNewMemberEvent([
		{ id: 1, username: "bot1", is_bot: true },
		{ id: 2, username: "bot2", is_bot: true },
	]);
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "none");
});

Deno.test("should welcome new human member with default message", () => {
	const ev = makeNewMemberEvent([
		{ id: 123, username: "newuser", first_name: "Alice" },
	]);
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertEquals(result.text!.includes("@newuser"), true);
		assertEquals(result.text!.includes("Welcome"), true);
	}
});

Deno.test("should use custom message from config", () => {
	const ev = makeNewMemberEvent(
		[{ id: 123, username: "newuser", first_name: "Alice" }],
		{ message: "Hello {display_name}, welcome to our group!" },
	);
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertEquals(result.text!, "Hello @newuser, welcome to our group!");
	}
});

Deno.test("should welcome multiple members", () => {
	const ev = makeNewMemberEvent([
		{ id: 1, username: "user1", first_name: "Alice" },
		{ id: 2, username: "user2", first_name: "Bob" },
	]);
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertEquals(result.text!.includes("@user1"), true);
		assertEquals(result.text!.includes("@user2"), true);
	}
});

Deno.test("should filter out bots when humans also join", () => {
	const ev = makeNewMemberEvent([
		{ id: 1, username: "human", first_name: "Alice", is_bot: false },
		{ id: 2, username: "robot", first_name: "Bot", is_bot: true },
	]);
	const result = service.handlers.message(ev) as ServiceResponse;
	assertEquals(result.kind, "reply");
	if (result.kind === "reply") {
		assertEquals(result.text!.includes("@human"), true);
		assertEquals(result.text!.includes("robot"), false);
	}
});

Deno.test("should have correct service metadata", () => {
	assertEquals(service.id, "new_member");
	assertEquals(service.kind, "listener");
});
