// src/sdk/ui.ts
// Cross-platform UI abstractions for service responses

export interface UIButton {
	text: string;
	action: UIButtonAction;
	style?: "primary" | "secondary" | "danger";
	disabled?: boolean;
}

export type UIButtonAction =
	| { type: "callback"; data: string }
	| { type: "url"; url: string }
	| { type: "share"; text: string }
	| { type: "contact" }
	| { type: "location" };

export interface UIKeyboard {
	buttons: UIButton[][];
	inline?: boolean;
	oneTime?: boolean;
	resizeKeyboard?: boolean;
	placeholder?: string;
}

export interface UIMenu {
	title?: string;
	description?: string;
	buttons: UIButton[];
	columns?: number;
}

export interface UICard {
	title?: string;
	description?: string;
	image?: string;
	actions?: UIButton[];
}

export interface UICarousel {
	items: UICard[];
	navigation?: boolean;
}

// Inline keyboard (kept for Telegram-specific convenience but adapter-agnostic shape)
export interface InlineButton {
	text: string;
	data: string;
	hide?: boolean;
}
export interface InlineKeyboardRowBuilder {
	button(btn: InlineButton): InlineKeyboardRowBuilder;
	buttons(btns: InlineButton[]): InlineKeyboardRowBuilder;
	row(): InlineKeyboardRowBuilder;
	done(): InlineKeyboardBuilder;
	build(): Record<string, unknown>;
}
export class InlineKeyboardBuilder implements InlineKeyboardRowBuilder {
	private rows: { text: string; callback_data: string }[][] = [];
	private current: { text: string; callback_data: string }[] = [];
	button(btn: InlineButton): InlineKeyboardRowBuilder {
		if (!btn.hide) this.current.push({ text: btn.text, callback_data: btn.data });
		return this;
	}
	buttons(btns: InlineButton[]): InlineKeyboardRowBuilder {
		for (const b of btns) this.button(b);
		return this;
	}
	row(): InlineKeyboardRowBuilder {
		if (this.current.length) {
			this.rows.push(this.current);
			this.current = [];
		}
		return this;
	}
	done(): InlineKeyboardBuilder {
		if (this.current.length) this.row();
		return this;
	}
	build(): Record<string, unknown> {
		this.done();
		return { inline_keyboard: this.rows };
	}
}
export function inlineKeyboard(): InlineKeyboardBuilder {
	return new InlineKeyboardBuilder();
}

/**
 * Escape HTML-special characters (`&`, `<`, `>`) so user-provided text is
 * safe to embed inside `parse_mode: "HTML"` messages. Does not escape `"` or
 * `'` — those are only unsafe inside HTML attribute values, which the bot
 * doesn't build dynamically.
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * Builder for creating cross-platform UI elements.
 */
export class UIBuilder {
	/**
	 * Create a keyboard with buttons arranged in rows.
	 */
	static keyboard(): KeyboardBuilder {
		return new KeyboardBuilder();
	}

	/**
	 * Create a menu with buttons arranged in a grid.
	 */
	static menu(title?: string): MenuBuilder {
		return new MenuBuilder(title);
	}

	/**
	 * Create a card with content and actions.
	 */
	static card(title?: string): CardBuilder {
		return new CardBuilder(title);
	}

	/**
	 * Create a carousel of cards.
	 */
	static carousel(): CarouselBuilder {
		return new CarouselBuilder();
	}
}

export class KeyboardBuilder {
	private rows: UIButton[][] = [];
	private currentRow: UIButton[] = [];
	private opts: Partial<UIKeyboard> = {};
	private ns?: string; // service id for auto callback namespacing

	/**
	 * Add a button to the current row.
	 */
	button(text: string, action: UIButtonAction, style?: UIButton["style"]): this {
		this.currentRow.push({ text, action, style });
		return this;
	}

	/**
	 * Add a callback button to the current row.
	 */
	callback(text: string, data: string, style?: UIButton["style"]): this {
		return this.button(text, { type: "callback", data: this.applyNs(data) }, style);
	}

	/** Set a service namespace used to prefix callback data (svc:<serviceId>|<payload>). */
	namespace(serviceId: string): this {
		this.ns = serviceId;
		return this;
	}

	private applyNs(data: string): string {
		if (!this.ns) return data;
		if (data.startsWith("svc:")) return data; // already namespaced
		return `svc:${this.ns}|${data}`;
	}

	/**
	 * Add a URL button to the current row.
	 */
	url(text: string, url: string, style?: UIButton["style"]): this {
		return this.button(text, { type: "url", url }, style);
	}

	/**
	 * Start a new row of buttons.
	 */
	row(): this {
		if (this.currentRow.length > 0) {
			this.rows.push([...this.currentRow]);
			this.currentRow = [];
		}
		return this;
	}

	/**
	 * Set keyboard as inline
	 */
	inline(value = true): this {
		this.opts.inline = value;
		return this;
	}

	/**
	 * Set keyboard to resize automatically.
	 */
	resize(value = true): this {
		this.opts.resizeKeyboard = value;
		return this;
	}

	/**
	 * Set placeholder text for the keyboard.
	 */
	placeholder(text: string): this {
		this.opts.placeholder = text;
		return this;
	}

	/**
	 * Build the keyboard object.
	 */
	build(): UIKeyboard {
		// Add current row if it has buttons
		if (this.currentRow.length > 0) {
			this.rows.push([...this.currentRow]);
		}

		return {
			buttons: this.rows,
			inline: this.opts.inline ?? true,
			oneTime: this.opts.oneTime,
			resizeKeyboard: this.opts.resizeKeyboard,
			placeholder: this.opts.placeholder,
		};
	}
}
export class MenuBuilder {
	private buttons: UIButton[] = [];
	private title?: string;
	private desc?: string;
	private cols = 2;
	private ns?: string;

	constructor(title?: string) {
		this.title = title;
	}

	/**
	 * Set menu description.
	 */
	description(text: string): this {
		this.desc = text;
		return this;
	}

	/**
	 * Set number of columns for button layout.
	 */
	columns(count: number): this {
		this.cols = Math.max(1, count);
		return this;
	}

	/**
	 * Add a button to the menu.
	 */
	button(text: string, action: UIButtonAction, style?: UIButton["style"]): this {
		this.buttons.push({ text, action, style });
		return this;
	}

	/**
	 * Add a callback button to the menu.
	 */
	callback(text: string, data: string, style?: UIButton["style"]): this {
		return this.button(text, { type: "callback", data: this.applyNs(data) }, style);
	}

	/** Set a service namespace used to prefix callback data. */
	namespace(serviceId: string): this {
		this.ns = serviceId;
		return this;
	}

	private applyNs(data: string): string {
		if (!this.ns) return data;
		if (data.startsWith("svc:")) return data;
		return `svc:${this.ns}|${data}`;
	}

	/**
	 * Add a URL button to the menu.
	 */
	url(text: string, url: string, style?: UIButton["style"]): this {
		return this.button(text, { type: "url", url }, style);
	}

	/**
	 * Build the menu object.
	 */
	build(): UIMenu {
		return {
			title: this.title,
			description: this.desc,
			buttons: this.buttons,
			columns: this.cols,
		};
	}
}
export class CardBuilder {
	private title?: string;
	private desc?: string;
	private image?: string;
	private actions: UIButton[] = [];
	private ns?: string;

	constructor(title?: string) {
		this.title = title;
	}

	/** Set card description. */
	description(text: string): this {
		this.desc = text;
		return this;
	}

	/** Set card image URL. */
	imageUrl(url: string): this {
		this.image = url;
		return this;
	}

	/** Add an action button to the card. */
	action(text: string, action: UIButtonAction, style?: UIButton["style"]): this {
		this.actions.push({ text, action, style });
		return this;
	}

	/** Add a callback action to the card. */
	callback(text: string, data: string, style?: UIButton["style"]): this {
		return this.action(text, { type: "callback", data: this.applyNs(data) }, style);
	}

	/** Set a service namespace used to prefix callback data. */
	namespace(serviceId: string): this {
		this.ns = serviceId;
		return this;
	}

	private applyNs(data: string): string {
		if (!this.ns) return data;
		if (data.startsWith("svc:")) return data;
		return `svc:${this.ns}|${data}`;
	}

	/** Add a URL action to the card. */
	url(text: string, url: string, style?: UIButton["style"]): this {
		return this.action(text, { type: "url", url }, style);
	}

	/** Build the card object. */
	build(): UICard {
		return {
			title: this.title,
			description: this.desc,
			image: this.image,
			actions: this.actions.length > 0 ? this.actions : undefined,
		};
	}
}

export class CarouselBuilder {
	private items: UICard[] = [];
	private nav = false;
	private ns?: string;

	/** Add a card to the carousel. */
	card(card: UICard): this {
		this.items.push(card);
		return this;
	}

	/** Enable navigation controls. */
	navigation(enabled = true): this {
		this.nav = enabled;
		return this;
	}

	/** Set a service namespace used to prefix internally generated navigation callbacks (future use). */
	namespace(serviceId: string): this {
		this.ns = serviceId;
		return this;
	}

	/** Build the carousel object. */
	build(): UICarousel {
		return {
			items: this.items,
			navigation: this.nav,
		};
	}
}
