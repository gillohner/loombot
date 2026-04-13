// src/core/config/merge.ts
// Resolves the effective feature list for a specific chat by merging:
//   1. operator config (config.yaml)
//   2. chat-type defaults (dms / groups)
//   3. per-chat overrides from chat_feature_overrides table
//
// Feature-specific chat overrides live in the `data` JSON blob. Supported today:
//   - meetups:    data.selected_calendar_ids?: string[], data.external_calendars?: string[],
//                 data.periodic?: { enabled?, day?, hour?, timezone?, range?, pin?, unpin_previous? }
//   - new_member: data.welcome_override?: string

import type { FeatureConfig, OperatorConfig } from "@core/config/schema.ts";
import {
	getServiceEntry,
	getServiceKind,
	getServiceNet,
	type ServiceKind,
	serviceRequiresPubky,
} from "@services/registry.ts";
import { getChatFeatureOverrides } from "@core/config/store.ts";

export type ChatType = "private" | "group" | "supergroup" | "channel" | string;

export interface ResolvedFeature {
	featureId: string;
	service: string;
	kind: ServiceKind;
	entry: string;
	command: string;
	enabled: boolean;
	lock: boolean;
	config: Record<string, unknown>;
	datasets?: Record<string, unknown>;
	net?: string[];
	/** Non-null when the chat stored any override for this feature. */
	overrideData: Record<string, unknown>;
}

export interface ResolvedChatConfig {
	features: ResolvedFeature[];
	/** Only the enabled features — convenience view for the snapshot builder. */
	enabledFeatures: ResolvedFeature[];
}

export interface ResolveOptions {
	chatType?: ChatType;
	operatorConfig: OperatorConfig;
}

export function resolveChatConfig(
	chatId: string,
	opts: ResolveOptions,
): ResolvedChatConfig {
	const overrides = new Map<string, { enabled: boolean | null; data: Record<string, unknown> }>();
	for (const row of getChatFeatureOverrides(chatId)) {
		overrides.set(row.feature_id, { enabled: row.enabled, data: row.data });
	}

	const isDm = opts.chatType === "private";
	const pubkyEnabled = opts.operatorConfig.pubky.enabled === true;
	const features: ResolvedFeature[] = [];

	for (const [featureId, feature] of Object.entries(opts.operatorConfig.features)) {
		const kind = getServiceKind(feature.service);
		const entry = getServiceEntry(feature.service);
		const baseNet = getServiceNet(feature.service);

		const defaultEnabled = isDm ? feature.dms : feature.groups;
		const pubkyBlocked = serviceRequiresPubky(feature.service) && !pubkyEnabled;

		let enabled = defaultEnabled && !pubkyBlocked;
		const override = overrides.get(featureId);
		if (override && override.enabled !== null && !feature.lock && !pubkyBlocked) {
			enabled = override.enabled;
		}

		const overrideData = override?.data ?? {};

		const config = applyFeatureOverrides(feature, overrideData);
		const datasets = feature.datasets as Record<string, unknown> | undefined;

		features.push({
			featureId,
			service: feature.service,
			kind,
			entry,
			command: feature.command ?? featureId,
			enabled,
			lock: feature.lock,
			config,
			datasets,
			net: baseNet,
			overrideData,
		});
	}

	return {
		features,
		enabledFeatures: features.filter((f) => f.enabled),
	};
}

// Apply feature-specific per-chat overrides to the operator config object.
// Keep this function pure and well-typed to each feature's shape.
function applyFeatureOverrides(
	feature: FeatureConfig,
	overrideData: Record<string, unknown>,
): Record<string, unknown> {
	const base = { ...(feature.config ?? {}) };

	if (feature.service === "meetups") {
		const calendars = Array.isArray(base.calendars)
			? (base.calendars as Array<{ id?: string; uri: string; name?: string }>)
			: [];
		const selected = overrideData.selected_calendar_ids;
		const external = overrideData.external_calendars;

		let resolvedCalendars: Array<{ uri: string; name?: string }> = calendars;
		if (Array.isArray(selected) && selected.length > 0) {
			const set = new Set(selected as string[]);
			resolvedCalendars = calendars.filter((c) => typeof c.id === "string" && set.has(c.id!));
		}
		if (Array.isArray(external) && external.length > 0) {
			for (const uri of external as string[]) {
				if (typeof uri === "string" && uri.startsWith("pubky://")) {
					resolvedCalendars = [...resolvedCalendars, { uri }];
				}
			}
		}
		// Drop the operator-only `id` field before passing to the service.
		base.calendars = resolvedCalendars.map(({ uri, name }) => ({ uri, name }));

		const periodic = overrideData.periodic;
		if (periodic && typeof periodic === "object") {
			const p = periodic as Record<string, unknown>;
			if (typeof p.enabled === "boolean") base.periodicEnabled = p.enabled;
			if (typeof p.day === "number") base.periodicDay = p.day;
			if (typeof p.hour === "number") base.periodicHour = p.hour;
			if (typeof p.timezone === "string") base.periodicTimezone = p.timezone;
			if (typeof p.range === "string") base.periodicRange = p.range;
			if (typeof p.pin === "boolean") base.periodicPin = p.pin;
			if (typeof p.unpin_previous === "boolean") base.periodicUnpinPrevious = p.unpin_previous;
		}
	}

	if (feature.service === "new_member") {
		const override = overrideData.welcome_override;
		if (typeof override === "string" && override.trim().length > 0) {
			base.message = override;
		}
	}

	return base;
}

// Query helpers used by the /config inline menu.

export function listTogglableFeatures(resolved: ResolvedChatConfig): ResolvedFeature[] {
	return resolved.features.filter((f) => !f.lock);
}

export function findFeature(
	resolved: ResolvedChatConfig,
	featureId: string,
): ResolvedFeature | undefined {
	return resolved.features.find((f) => f.featureId === featureId);
}
