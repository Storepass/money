/**
 * Currency metadata.
 *
 * For ISO 4217 currencies, `iso4217` is `true` and `numericCode` is the
 * official 3-digit numeric code. `displayCode` is an optional override that
 * `Intl.NumberFormat` should use when the primary `code` is non-standard
 * (e.g., legacy systems calling Bitcoin "BTC" instead of the unofficial "XBT").
 *
 * Standard currencies in this file follow ISO 4217 as of revision 173
 * (published 2024-06). Run `bun run scripts/sync-iso4217.ts` to refresh.
 */
export interface CurrencyDefinition {
	/** Alpha code (typically ISO 4217 alpha-3, but free-form for custom assets). */
	code: string;
	/** Minor-unit precision used for internal arithmetic. */
	decimalPlaces: number;
	/** ISO 4217 numeric code (0-999). Omitted for non-standard assets. */
	numericCode?: number;
	/** `true` when `code` is an officially registered ISO 4217 alpha-3 code. */
	iso4217?: boolean;
	/**
	 * Optional alpha-3 used for `Intl.NumberFormat` display. Falls back to `code`.
	 * Useful for non-ISO codes that have a registered alias.
	 */
	displayCode?: string;
}

export const Currency = {
	USD: { code: "USD", decimalPlaces: 2, numericCode: 840, iso4217: true },
	USDH: { code: "USDH", decimalPlaces: 3, iso4217: false, displayCode: "USD" },
	EUR: { code: "EUR", decimalPlaces: 2, numericCode: 978, iso4217: true },
	GBP: { code: "GBP", decimalPlaces: 2, numericCode: 826, iso4217: true },
	JPY: { code: "JPY", decimalPlaces: 0, numericCode: 392, iso4217: true },
	CAD: { code: "CAD", decimalPlaces: 2, numericCode: 124, iso4217: true },
	AUD: { code: "AUD", decimalPlaces: 2, numericCode: 36, iso4217: true },
	NZD: { code: "NZD", decimalPlaces: 2, numericCode: 554, iso4217: true },
	CHF: { code: "CHF", decimalPlaces: 2, numericCode: 756, iso4217: true },
	SEK: { code: "SEK", decimalPlaces: 2, numericCode: 752, iso4217: true },
	NOK: { code: "NOK", decimalPlaces: 2, numericCode: 578, iso4217: true },
	DKK: { code: "DKK", decimalPlaces: 2, numericCode: 208, iso4217: true },
	PLN: { code: "PLN", decimalPlaces: 2, numericCode: 985, iso4217: true },
	CZK: { code: "CZK", decimalPlaces: 2, numericCode: 203, iso4217: true },
	HUF: { code: "HUF", decimalPlaces: 2, numericCode: 348, iso4217: true },
	BRL: { code: "BRL", decimalPlaces: 2, numericCode: 986, iso4217: true },
	MXN: { code: "MXN", decimalPlaces: 2, numericCode: 484, iso4217: true },
	ARS: { code: "ARS", decimalPlaces: 2, numericCode: 32, iso4217: true },
	CLP: { code: "CLP", decimalPlaces: 0, numericCode: 152, iso4217: true },
	INR: { code: "INR", decimalPlaces: 2, numericCode: 356, iso4217: true },
	SGD: { code: "SGD", decimalPlaces: 2, numericCode: 702, iso4217: true },
	HKD: { code: "HKD", decimalPlaces: 2, numericCode: 344, iso4217: true },
	KRW: { code: "KRW", decimalPlaces: 0, numericCode: 410, iso4217: true },
	CNY: { code: "CNY", decimalPlaces: 2, numericCode: 156, iso4217: true },
	ZAR: { code: "ZAR", decimalPlaces: 2, numericCode: 710, iso4217: true },
	AED: { code: "AED", decimalPlaces: 2, numericCode: 784, iso4217: true },
	SAR: { code: "SAR", decimalPlaces: 2, numericCode: 682, iso4217: true },
	BTC: { code: "BTC", decimalPlaces: 8, iso4217: false },
} as const satisfies Record<string, CurrencyDefinition>;

export type CurrencyCode = keyof typeof Currency;
export type CurrencyType = (typeof Currency)[CurrencyCode];

export interface ResolveCurrencyOptions {
	/**
	 * When set, an unknown code resolves to `defineCurrency(code, fallbackDecimalPlaces)`
	 * instead of `undefined`. The definition is cached, so repeated calls with
	 * the same code and decimal places return the same object.
	 */
	fallbackDecimalPlaces?: number;
}

const builtInCurrencies = new Map<string, CurrencyDefinition>(
	Object.entries(Currency),
);
const fallbackCurrencies = new Map<string, CurrencyDefinition>();

/**
 * Looks up a currency definition by code. A built-in code returns the same
 * object as `Currency[code]`; an unknown code returns `undefined` unless
 * `fallbackDecimalPlaces` is given.
 */
export function resolveCurrency(
	code: string,
	options: ResolveCurrencyOptions = {},
): CurrencyDefinition | undefined {
	const builtIn = builtInCurrencies.get(code);
	if (builtIn !== undefined) return builtIn;

	const { fallbackDecimalPlaces } = options;
	if (fallbackDecimalPlaces === undefined) return undefined;

	const key = `${code}:${fallbackDecimalPlaces}`;
	let definition = fallbackCurrencies.get(key);
	if (definition === undefined) {
		definition = defineCurrency(code, fallbackDecimalPlaces);
		fallbackCurrencies.set(key, definition);
	}
	return definition;
}

export interface DefineCurrencyOptions {
	numericCode?: number;
	iso4217?: boolean;
	displayCode?: string;
}

const ISO_ALPHA3 = /^[A-Z]{3}$/;

export function defineCurrency(
	code: string,
	decimalPlaces: number,
	options: DefineCurrencyOptions = {},
): CurrencyDefinition {
	if (!code || typeof code !== "string") {
		throw new Error("Currency code must be a non-empty string");
	}
	if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
		throw new Error("Decimal places must be a non-negative integer");
	}

	const { numericCode, iso4217, displayCode } = options;

	if (iso4217 === true) {
		if (!ISO_ALPHA3.test(code)) {
			throw new Error(
				`ISO 4217 currency code must be three uppercase letters: got "${code}"`,
			);
		}
		if (
			numericCode === undefined ||
			!Number.isInteger(numericCode) ||
			numericCode < 0 ||
			numericCode > 999
		) {
			throw new Error(
				"ISO 4217 currencies require an integer numericCode in 0..999",
			);
		}
	} else if (numericCode !== undefined) {
		if (
			!Number.isInteger(numericCode) ||
			numericCode < 0 ||
			numericCode > 999
		) {
			throw new Error("numericCode must be an integer in 0..999");
		}
	}

	if (displayCode !== undefined && !ISO_ALPHA3.test(displayCode)) {
		throw new Error(
			`displayCode must be three uppercase letters: got "${displayCode}"`,
		);
	}

	const def: CurrencyDefinition = { code, decimalPlaces };
	if (numericCode !== undefined) def.numericCode = numericCode;
	if (iso4217 !== undefined) def.iso4217 = iso4217;
	if (displayCode !== undefined) def.displayCode = displayCode;
	return Object.freeze(def);
}
