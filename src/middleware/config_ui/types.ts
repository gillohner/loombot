// src/middleware/config_ui/types.ts
// Minimal local type for inline-keyboard buttons. grammy's mod.ts does not
// re-export the Telegram `InlineKeyboardButton` type. Our /config flow only
// uses callback buttons, so we model just that variant — strict enough that
// the result assigns to grammY's discriminated `InlineKeyboardButton` union.

export type CallbackButton = {
	text: string;
	callback_data: string;
};

export type InlineKeyboard = CallbackButton[][];
