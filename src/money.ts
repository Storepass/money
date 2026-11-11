import type { CurrencyDefinition } from "./currency";

/**
 * How a value between two minor units is resolved.
 *
 * - `"floor"`: toward -Infinity.
 * - `"ceil"`: toward +Infinity.
 * - `"trunc"`: toward zero.
 * - `"round"`: to the nearest minor unit; an exact half goes toward
 *   +Infinity, so 2.5 becomes 3 and -2.5 becomes -2 (not half away from zero).
 */
export type RoundingMode = "floor" | "ceil" | "round" | "trunc";

export interface FromNumberOptions {
	rounding?: RoundingMode;
	strict?: boolean;
}

/** JSON-safe representation of a Money value. Amount is in minor units. */
export interface SerializedMoney {
	amount: number;
	currency: string;
}

type MoneyFormatOptions = Omit<
	Intl.NumberFormatOptions,
	"style" | "currency" | "minimumFractionDigits" | "maximumFractionDigits"
> & {
	minimumFractionDigits?: number;
	maximumFractionDigits?: number;
};

type DecimalStringNumberFormat = Intl.NumberFormat & {
	format(value: number | bigint | string): string;
};

// Internal precision for scaled integer arithmetic
// 20 decimal places to handle rates like 0.00001080599586018141
const INTERNAL_PRECISION = 20;
const INTERNAL_SCALE = 10n ** BigInt(INTERNAL_PRECISION);

/**
 * Converts a number to a decimal string representation.
 * Uses toString() which often gives cleaner results (e.g., 1.005 stays "1.005"),
 * but falls back to toPrecision for edge cases with very small/large numbers.
 */
function numberToDecimalString(n: number): string {
	// Handle special cases
	if (!Number.isFinite(n)) {
		throw new Error(`Cannot convert ${n} to decimal string`);
	}
	if (n === 0) return "0";

	// toString() often gives the cleanest representation
	const str = n.toString();

	// If it's in scientific notation, use toPrecision for more digits
	if (str.includes("e") || str.includes("E")) {
		return n.toPrecision(17);
	}

	return str;
}

function parseDecimalStringToScaled(str: string): bigint {
	// Handle sign
	const negative = str.startsWith("-");
	if (negative) str = str.slice(1);

	// Handle scientific notation
	const eIndex = str.toLowerCase().indexOf("e");
	if (eIndex !== -1) {
		const mantissa = str.slice(0, eIndex);
		const exponent = parseInt(str.slice(eIndex + 1), 10);
		const scaledMantissa = parseDecimalStringToScaled(mantissa);
		const sign = negative ? -1n : 1n;
		if (exponent >= 0) {
			return sign * scaledMantissa * 10n ** BigInt(exponent);
		} else {
			return (sign * scaledMantissa) / 10n ** BigInt(-exponent);
		}
	}

	// Split into integer and decimal parts
	const dotIndex = str.indexOf(".");
	let intPart: string;
	let decPart: string;
	if (dotIndex === -1) {
		intPart = str || "0";
		decPart = "";
	} else {
		intPart = str.slice(0, dotIndex) || "0";
		decPart = str.slice(dotIndex + 1);
	}

	// Pad or truncate decimal part to internal precision
	decPart = decPart
		.padEnd(INTERNAL_PRECISION, "0")
		.slice(0, INTERNAL_PRECISION);

	const scaledInt = BigInt(intPart) * INTERNAL_SCALE;
	const scaledDec = BigInt(decPart);
	const result = scaledInt + scaledDec;

	return negative ? -result : result;
}

function divideAndRound(
	dividend: bigint,
	divisor: bigint,
	mode: RoundingMode,
): bigint {
	if (divisor < 0n) {
		dividend = -dividend;
		divisor = -divisor;
	}

	const quotient = dividend / divisor;
	const remainder = dividend % divisor;

	if (remainder === 0n) return quotient;

	const isNegative = dividend < 0n;
	const doubledRemainder = (isNegative ? -remainder : remainder) * 2n;

	switch (mode) {
		case "floor":
			return isNegative ? quotient - 1n : quotient;
		case "ceil":
			return isNegative ? quotient : quotient + 1n;
		case "trunc":
			return quotient;
		default:
			// Round to nearest, half toward +Infinity
			if (
				doubledRemainder > divisor ||
				(doubledRemainder === divisor && !isNegative)
			) {
				return isNegative ? quotient - 1n : quotient + 1n;
			}
			return quotient;
	}
}

function roundScaledToMinor(
	scaled: bigint,
	targetDecimalPlaces: number,
	mode: RoundingMode,
): bigint {
	const targetScale = 10n ** BigInt(targetDecimalPlaces);
	return divideAndRound(scaled, INTERNAL_SCALE / targetScale, mode);
}

function currenciesMatch(
	a: CurrencyDefinition,
	b: CurrencyDefinition,
): boolean {
	return a.code === b.code && a.decimalPlaces === b.decimalPlaces;
}

function assertCurrenciesMatch(
	a: CurrencyDefinition,
	b: CurrencyDefinition,
	operation: string,
): void {
	if (!currenciesMatch(a, b)) {
		throw new Error(
			`Cannot ${operation} ${a.code} and ${b.code}: currency mismatch`,
		);
	}
}

function assertSafeResult(value: bigint): void {
	if (
		value > BigInt(Number.MAX_SAFE_INTEGER) ||
		value < BigInt(-Number.MAX_SAFE_INTEGER)
	) {
		throw new Error("Result too large: exceeds safe integer range");
	}
}

function minorToDecimalString(minor: bigint, decimalPlaces: number): string {
	const negative = minor < 0n;
	const absMinor = negative ? -minor : minor;

	if (decimalPlaces === 0) {
		return `${negative ? "-" : ""}${absMinor}`;
	}

	const scale = 10n ** BigInt(decimalPlaces);
	const whole = absMinor / scale;
	const fraction = (absMinor % scale).toString().padStart(decimalPlaces, "0");

	return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function resolveFractionDigits(
	decimalPlaces: number,
	options: MoneyFormatOptions,
): { minimumFractionDigits: number; maximumFractionDigits: number } {
	const { minimumFractionDigits, maximumFractionDigits } = options;

	return {
		minimumFractionDigits:
			minimumFractionDigits ??
			(maximumFractionDigits === undefined
				? decimalPlaces
				: Math.min(decimalPlaces, maximumFractionDigits)),
		maximumFractionDigits:
			maximumFractionDigits ??
			(minimumFractionDigits === undefined
				? decimalPlaces
				: Math.max(decimalPlaces, minimumFractionDigits)),
	};
}

function formatExactDecimal(format: Intl.NumberFormat, value: string): string {
	return (format as DecimalStringNumberFormat).format(value);
}

export class Money {
	readonly #minor: bigint;
	readonly #currency: CurrencyDefinition;

	private constructor(minor: bigint, currency: CurrencyDefinition) {
		this.#minor = minor;
		this.#currency = currency;
	}

	get currency(): CurrencyDefinition {
		return this.#currency;
	}

	static fromNumber(
		currency: CurrencyDefinition,
		value: number,
		options: FromNumberOptions = {},
	): Money {
		const { rounding = "round", strict } = options;

		// Check if the value, when converted to minor units, would exceed safe integer range
		const multiplier = 10 ** currency.decimalPlaces;
		const estimatedMinor = Math.abs(value) * multiplier;
		if (estimatedMinor > Number.MAX_SAFE_INTEGER) {
			throw new Error(
				`Value too large: ${value} exceeds safe integer range when converted to minor units`,
			);
		}

		// Convert to string to preserve decimal representation
		const valueStr = numberToDecimalString(value);
		const scaledValue = parseDecimalStringToScaled(valueStr);

		// For strict mode, check if value can be exactly represented
		if (strict) {
			const targetScale = 10n ** BigInt(currency.decimalPlaces);
			const divisor = INTERNAL_SCALE / targetScale;
			if (scaledValue % divisor !== 0n) {
				throw new Error(
					`Precision loss: ${value} cannot be exactly represented with ${currency.decimalPlaces} decimal places`,
				);
			}
		}

		const minor = roundScaledToMinor(
			scaledValue,
			currency.decimalPlaces,
			rounding,
		);
		assertSafeResult(minor);
		return new Money(minor, currency);
	}

	static fromMinor(currency: CurrencyDefinition, minor: number): Money {
		return new Money(BigInt(minor), currency);
	}

	static zero(currency: CurrencyDefinition): Money {
		return new Money(0n, currency);
	}

	toNumber(): number {
		const divisor = 10 ** this.#currency.decimalPlaces;
		return Number(this.#minor) / divisor;
	}

	toMinor(): number {
		return Number(this.#minor);
	}

	// Static arithmetic methods

	static add(a: Money, b: Money): Money {
		assertCurrenciesMatch(a.#currency, b.#currency, "add");
		const result = a.#minor + b.#minor;
		assertSafeResult(result);
		return new Money(result, a.#currency);
	}

	static subtract(a: Money, b: Money): Money {
		assertCurrenciesMatch(a.#currency, b.#currency, "subtract");
		const result = a.#minor - b.#minor;
		assertSafeResult(result);
		return new Money(result, a.#currency);
	}

	/**
	 * Adds every item. Without `currency`, the list must be non-empty and the
	 * first item sets the currency. With `currency`, an empty list returns
	 * `Money.zero(currency)` and every item must match `currency`.
	 */
	static sum(items: readonly Money[], currency?: CurrencyDefinition): Money {
		if (currency === undefined) {
			const first = items[0];
			if (first === undefined) {
				throw new Error(
					"Cannot sum empty array: at least one Money value required",
				);
			}
			currency = first.#currency;
		}
		let total = 0n;
		for (const item of items) {
			assertCurrenciesMatch(item.#currency, currency, "sum");
			total += item.#minor;
		}
		assertSafeResult(total);
		return new Money(total, currency);
	}

	/**
	 * True when every item's currency matches `currency` (or the first item's
	 * currency when omitted), using the same rule as arithmetic: equal `code`
	 * and `decimalPlaces`. An empty list is true.
	 */
	static sameCurrency(
		items: readonly Money[],
		currency?: CurrencyDefinition,
	): boolean {
		const target = currency ?? items[0]?.currency;
		if (target === undefined) return true;
		return items.every((item) => currenciesMatch(item.#currency, target));
	}

	// Static comparison methods

	static equals(a: Money, b: Money): boolean {
		assertCurrenciesMatch(a.#currency, b.#currency, "compare");
		return a.#minor === b.#minor;
	}

	static compare(a: Money, b: Money): number {
		assertCurrenciesMatch(a.#currency, b.#currency, "compare");
		if (a.#minor < b.#minor) return -1;
		if (a.#minor > b.#minor) return 1;
		return 0;
	}

	static lessThan(a: Money, b: Money): boolean {
		assertCurrenciesMatch(a.#currency, b.#currency, "compare");
		return a.#minor < b.#minor;
	}

	static greaterThan(a: Money, b: Money): boolean {
		assertCurrenciesMatch(a.#currency, b.#currency, "compare");
		return a.#minor > b.#minor;
	}

	static lessThanOrEqual(a: Money, b: Money): boolean {
		assertCurrenciesMatch(a.#currency, b.#currency, "compare");
		return a.#minor <= b.#minor;
	}

	static greaterThanOrEqual(a: Money, b: Money): boolean {
		assertCurrenciesMatch(a.#currency, b.#currency, "compare");
		return a.#minor >= b.#minor;
	}

	// Instance method wrappers

	add(other: Money): Money {
		return Money.add(this, other);
	}

	subtract(other: Money): Money {
		return Money.subtract(this, other);
	}

	equals(other: Money): boolean {
		return Money.equals(this, other);
	}

	compare(other: Money): number {
		return Money.compare(this, other);
	}

	lessThan(other: Money): boolean {
		return Money.lessThan(this, other);
	}

	greaterThan(other: Money): boolean {
		return Money.greaterThan(this, other);
	}

	lessThanOrEqual(other: Money): boolean {
		return Money.lessThanOrEqual(this, other);
	}

	greaterThanOrEqual(other: Money): boolean {
		return Money.greaterThanOrEqual(this, other);
	}

	// Predicates

	isZero(): boolean {
		return this.#minor === 0n;
	}

	isPositive(): boolean {
		return this.#minor > 0n;
	}

	isNegative(): boolean {
		return this.#minor < 0n;
	}

	// Allocation

	static allocate(money: Money, parts: number): Money[] {
		if (!Number.isInteger(parts) || parts < 1) {
			throw new Error("Allocation count must be a positive integer");
		}
		if (!Number.isSafeInteger(parts)) {
			throw new Error("Allocation count must be a safe integer");
		}

		const partsBigInt = BigInt(parts);
		const base = money.#minor / partsBigInt;
		const remainder = money.#minor % partsBigInt;
		const absRemainder = remainder < 0n ? -remainder : remainder;
		const sign = remainder < 0n ? -1n : 1n;

		const result: Money[] = [];
		for (let i = 0n; i < partsBigInt; i++) {
			const extra = i < absRemainder ? sign : 0n;
			result.push(new Money(base + extra, money.#currency));
		}

		return result;
	}

	allocate(parts: number): Money[] {
		return Money.allocate(this, parts);
	}

	// Conversion

	static convert(
		money: Money,
		targetCurrency: CurrencyDefinition,
		rate: number,
		options: { rounding?: RoundingMode } = {},
	): Money {
		if (!Number.isFinite(rate) || rate <= 0) {
			throw new Error("Exchange rate must be a finite positive number");
		}

		const { rounding = "round" } = options;

		// Parse rate to scaled bigint
		const scaledRate = parseDecimalStringToScaled(numberToDecimalString(rate));

		// Scale source to internal precision
		const sourceScale = 10n ** BigInt(money.#currency.decimalPlaces);
		const scaledSource = money.#minor * (INTERNAL_SCALE / sourceScale);

		// Multiply and scale back down
		const rawProduct = (scaledSource * scaledRate) / INTERNAL_SCALE;

		const resultMinor = roundScaledToMinor(
			rawProduct,
			targetCurrency.decimalPlaces,
			rounding,
		);
		assertSafeResult(resultMinor);
		return new Money(resultMinor, targetCurrency);
	}

	convert(
		targetCurrency: CurrencyDefinition,
		rate: number,
		options?: { rounding?: RoundingMode },
	): Money {
		return Money.convert(this, targetCurrency, rate, options);
	}

	// Rounding

	static roundTo(
		money: Money,
		increment: number,
		mode: RoundingMode = "round",
	): Money {
		if (!Number.isFinite(increment) || increment <= 0) {
			throw new Error("Rounding increment must be a finite positive number");
		}

		// Parse increment to scaled bigint
		const scaledIncrement = parseDecimalStringToScaled(
			numberToDecimalString(increment),
		);

		// Convert to minor units and verify exact representation
		const targetScale = 10n ** BigInt(money.#currency.decimalPlaces);
		const divisor = INTERNAL_SCALE / targetScale;

		if (scaledIncrement % divisor !== 0n) {
			throw new Error(
				`Rounding increment ${increment} cannot be exactly represented with ${money.#currency.decimalPlaces} decimal places`,
			);
		}

		const incrementMinor = scaledIncrement / divisor;
		if (incrementMinor === 0n) {
			throw new Error(
				"Rounding increment is too small for this currency's precision",
			);
		}

		const minor = money.#minor;
		const remainder = minor % incrementMinor;

		if (remainder === 0n) {
			return new Money(minor, money.#currency);
		}

		const base = minor - remainder;
		let rounded: bigint;

		switch (mode) {
			case "trunc":
				rounded = base;
				break;
			case "floor":
				rounded = minor < 0n ? base - incrementMinor : base;
				break;
			case "ceil":
				rounded = minor < 0n ? base : base + incrementMinor;
				break;
			default: {
				const absRemainder = remainder < 0n ? -remainder : remainder;
				const cmp = absRemainder * 2n - incrementMinor;
				if (cmp < 0n) {
					rounded = base;
				} else if (cmp > 0n) {
					rounded = minor < 0n ? base - incrementMinor : base + incrementMinor;
				} else {
					rounded = minor < 0n ? base : base + incrementMinor;
				}
				break;
			}
		}

		assertSafeResult(rounded);
		return new Money(rounded, money.#currency);
	}

	round(increment: number, mode?: RoundingMode): Money {
		return Money.roundTo(this, increment, mode);
	}

	// Ratio scaling

	/**
	 * Returns `money × numerator ÷ denominator` in `money`'s currency, computed
	 * exactly on minor units with a single rounding (default `"round"`).
	 *
	 * The ratio is dimensionless: `numerator` and `denominator` must share a
	 * currency with each other, but not with `money`. Throws when the
	 * denominator is zero, when the ratio's currencies differ, or when the
	 * result exceeds the safe integer range.
	 */
	static scaleByRatio(
		money: Money,
		numerator: Money,
		denominator: Money,
		options: { rounding?: RoundingMode } = {},
	): Money {
		assertCurrenciesMatch(
			numerator.#currency,
			denominator.#currency,
			"form a ratio from",
		);
		if (denominator.#minor === 0n) {
			throw new Error("Cannot scale by a ratio with a zero denominator");
		}

		const { rounding = "round" } = options;
		const resultMinor = divideAndRound(
			money.#minor * numerator.#minor,
			denominator.#minor,
			rounding,
		);
		assertSafeResult(resultMinor);
		return new Money(resultMinor, money.#currency);
	}

	scaleByRatio(
		numerator: Money,
		denominator: Money,
		options?: { rounding?: RoundingMode },
	): Money {
		return Money.scaleByRatio(this, numerator, denominator, options);
	}

	// Percent operations

	static percentOf(
		money: Money,
		percent: number,
		options: { rounding?: RoundingMode } = {},
	): Money {
		const { rounding = "round" } = options;

		const scaledPercent = parseDecimalStringToScaled(
			numberToDecimalString(percent),
		);
		const scaledHundred = 100n * INTERNAL_SCALE;

		// Scale money to internal precision
		const currencyScale = 10n ** BigInt(money.#currency.decimalPlaces);
		const scaledMoney = money.#minor * (INTERNAL_SCALE / currencyScale);

		// Calculate: scaledMoney * scaledPercent / scaledHundred
		const rawResult = (scaledMoney * scaledPercent) / scaledHundred;

		const resultMinor = roundScaledToMinor(
			rawResult,
			money.#currency.decimalPlaces,
			rounding,
		);
		assertSafeResult(resultMinor);
		return new Money(resultMinor, money.#currency);
	}

	static incrementByPercent(
		money: Money,
		percent: number,
		options: { rounding?: RoundingMode } = {},
	): Money {
		const { rounding = "round" } = options;

		const scaledPercent = parseDecimalStringToScaled(
			numberToDecimalString(percent),
		);
		const scaledHundred = 100n * INTERNAL_SCALE;

		// Scale money to internal precision
		const currencyScale = 10n ** BigInt(money.#currency.decimalPlaces);
		const scaledMoney = money.#minor * (INTERNAL_SCALE / currencyScale);

		// Calculate: scaledMoney * (100 + percent) / 100
		const rawResult =
			(scaledMoney * (scaledHundred + scaledPercent)) / scaledHundred;

		const resultMinor = roundScaledToMinor(
			rawResult,
			money.#currency.decimalPlaces,
			rounding,
		);
		assertSafeResult(resultMinor);
		return new Money(resultMinor, money.#currency);
	}

	static decrementByPercent(
		money: Money,
		percent: number,
		options: { rounding?: RoundingMode } = {},
	): Money {
		const { rounding = "round" } = options;

		const scaledPercent = parseDecimalStringToScaled(
			numberToDecimalString(percent),
		);
		const scaledHundred = 100n * INTERNAL_SCALE;

		// Scale money to internal precision
		const currencyScale = 10n ** BigInt(money.#currency.decimalPlaces);
		const scaledMoney = money.#minor * (INTERNAL_SCALE / currencyScale);

		// Calculate: scaledMoney * (100 - percent) / 100
		const rawResult =
			(scaledMoney * (scaledHundred - scaledPercent)) / scaledHundred;

		const resultMinor = roundScaledToMinor(
			rawResult,
			money.#currency.decimalPlaces,
			rounding,
		);
		assertSafeResult(resultMinor);
		return new Money(resultMinor, money.#currency);
	}

	percentOf(percent: number, options?: { rounding?: RoundingMode }): Money {
		return Money.percentOf(this, percent, options);
	}

	incrementByPercent(
		percent: number,
		options?: { rounding?: RoundingMode },
	): Money {
		return Money.incrementByPercent(this, percent, options);
	}

	decrementByPercent(
		percent: number,
		options?: { rounding?: RoundingMode },
	): Money {
		return Money.decrementByPercent(this, percent, options);
	}

	// Serialization

	toJSON(): SerializedMoney {
		return {
			amount: this.toMinor(),
			currency: this.#currency.code,
		};
	}

	/**
	 * Format this Money for display using `Intl.NumberFormat`.
	 *
	 * - For ISO 4217 currencies, uses `style: "currency"` with the standard code
	 *   (or `displayCode` if provided), respecting the currency's
	 *   `decimalPlaces` (overrides Intl's locale-default fraction digits).
	 * - For non-ISO codes without a `displayCode`, falls back to a decimal
	 *   format prefixed with the currency code (e.g., `"BTC 0.12345678"`).
	 * - If a runtime rejects the currency code (older engines, exotic locales),
	 *   the same decimal fallback is used.
	 */
	format(
		locales?: string | string[],
		options: MoneyFormatOptions = {},
	): string {
		const value = minorToDecimalString(
			this.#minor,
			this.#currency.decimalPlaces,
		);
		const dp = this.#currency.decimalPlaces;
		const displayCode = this.#currency.displayCode ?? this.#currency.code;
		const canUseCurrencyStyle =
			this.#currency.iso4217 === true ||
			this.#currency.displayCode !== undefined;

		const fractionDigits = resolveFractionDigits(dp, options);

		if (canUseCurrencyStyle) {
			try {
				return formatExactDecimal(
					new Intl.NumberFormat(locales, {
						...options,
						...fractionDigits,
						style: "currency",
						currency: displayCode,
					}),
					value,
				);
			} catch {
				// Fall through to decimal fallback
			}
		}

		const number = formatExactDecimal(
			new Intl.NumberFormat(locales, {
				...options,
				...fractionDigits,
				style: "decimal",
			}),
			value,
		);
		return `${this.#currency.code} ${number}`;
	}
}
