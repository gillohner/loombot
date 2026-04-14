// sdk/mod.ts - curated public SDK surface
export * from "./service.ts";
export * from "./state.ts";
export * from "./events.ts";
export * from "./responses/types.ts";
export * from "./responses/factory.ts";
export * from "./i18n.ts";
export * from "./ui.ts"; // includes inlineKeyboard + builders
export * from "./schema.ts"; // JSON Schema types for config/dataset validation
export { runService } from "./runner.ts";
export { SERVICE_PROTOCOL_SCHEMA_VERSION } from "./services_types.ts";
export type {
	DispatcherResult,
	SandboxExecuteEvent,
	SandboxExecuteEventCallback,
	SandboxExecuteEventCommand,
	SandboxExecuteEventMessage,
	SandboxExecuteResult,
	SandboxManifest,
	SandboxPayload,
	ServiceCapability,
	ServiceCapabilityRequest,
	ServiceManifestProtocol,
} from "./services_types.ts";
