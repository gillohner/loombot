// src/core/pubky/pubky.ts
// NOTE: The old multi-layer Pubky config-fetching system has been replaced by
// local config.yaml + per-chat overrides (see src/core/config/merge.ts). This
// file is now a thin re-export shim kept only for anything that may still
// import calendar helpers by the old path.

export {
	type CalendarMeta,
	fetchCalendarMeta,
	isValidCalendarUri,
	normalizeCalendarUri,
} from "@core/pubky/calendar_meta.ts";
