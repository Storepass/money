import { describe, expect, test } from "bun:test";
import { Currency, defineCurrency, Money } from "../src";

const usd = (minor: number) => Money.fromMinor(Currency.USD, minor);
const eur = (minor: number) => Money.fromMinor(Currency.EUR, minor);

describe("Money.zero", () => {
	test("is zero in the given currency", () => {
		const zero = Money.zero(Currency.USD);
		expect(zero.isZero()).toBe(true);
		expect(zero.toJSON()).toEqual({ amount: 0, currency: "USD" });
		expect(zero.currency).toBe(Currency.USD);
	});

	test("equals fromMinor(currency, 0)", () => {
		expect(
			Money.zero(Currency.JPY).equals(Money.fromMinor(Currency.JPY, 0)),
		).toBe(true);
	});
});

describe("Money.sum with a currency", () => {
	test("returns zero for an empty list", () => {
		const total = Money.sum([], Currency.USD);
		expect(total.isZero()).toBe(true);
		expect(total.currency).toBe(Currency.USD);
	});

	test("adds items that match the currency", () => {
		expect(Money.sum([usd(1), usd(2), usd(3)], Currency.USD).toMinor()).toBe(6);
	});

	test("throws when an item does not match the currency", () => {
		expect(() => Money.sum([usd(1)], Currency.EUR)).toThrow(
			/currency mismatch/,
		);
	});

	test("without a currency, an empty list still throws", () => {
		expect(() => Money.sum([])).toThrow(/Cannot sum empty array/);
	});

	test("without a currency, mixed currencies still throw", () => {
		expect(() => Money.sum([usd(1), eur(2)])).toThrow(/currency mismatch/);
	});

	test("checks the safe integer range", () => {
		expect(() =>
			Money.sum([usd(Number.MAX_SAFE_INTEGER), usd(1)], Currency.USD),
		).toThrow("Result too large");
	});
});

describe("Money.sameCurrency", () => {
	test("is true for an empty list", () => {
		expect(Money.sameCurrency([])).toBe(true);
		expect(Money.sameCurrency([], Currency.USD)).toBe(true);
	});

	test("compares against the first item when no currency is given", () => {
		expect(Money.sameCurrency([usd(1), usd(2)])).toBe(true);
		expect(Money.sameCurrency([usd(1), eur(2)])).toBe(false);
	});

	test("compares against the given currency", () => {
		expect(Money.sameCurrency([usd(1)], Currency.USD)).toBe(true);
		expect(Money.sameCurrency([usd(1)], Currency.EUR)).toBe(false);
	});

	test("uses code and decimal places, not object identity", () => {
		expect(Money.sameCurrency([usd(1)], defineCurrency("USD", 2))).toBe(true);
		expect(Money.sameCurrency([usd(1)], defineCurrency("USD", 3))).toBe(false);
	});
});
