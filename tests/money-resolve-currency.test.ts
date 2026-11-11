import { describe, expect, test } from "bun:test";
import { Currency, Money, resolveCurrency } from "../src";

describe("resolveCurrency", () => {
	test("returns the built-in definition object", () => {
		expect(resolveCurrency("USD")).toBe(Currency.USD);
		expect(resolveCurrency("JPY", { fallbackDecimalPlaces: 2 })).toBe(
			Currency.JPY,
		);
	});

	test("returns undefined for an unknown code without a fallback", () => {
		expect(resolveCurrency("XYZ")).toBeUndefined();
		expect(resolveCurrency("toString")).toBeUndefined();
	});

	test("defines and caches an unknown code with a fallback", () => {
		const first = resolveCurrency("XYZ", { fallbackDecimalPlaces: 2 });
		expect(first).toEqual({ code: "XYZ", decimalPlaces: 2 });
		expect(resolveCurrency("XYZ", { fallbackDecimalPlaces: 2 })).toBe(first);
		expect(
			resolveCurrency("XYZ", { fallbackDecimalPlaces: 3 })?.decimalPlaces,
		).toBe(3);
	});

	test("resolved fallback currencies interoperate in arithmetic", () => {
		const a = resolveCurrency("XYZ", { fallbackDecimalPlaces: 2 });
		const b = resolveCurrency("XYZ", { fallbackDecimalPlaces: 2 });
		if (a === undefined || b === undefined) throw new Error("unresolved");
		expect(Money.fromMinor(a, 1).add(Money.fromMinor(b, 2)).toMinor()).toBe(3);
	});

	test("rejects an invalid fallback", () => {
		expect(() => resolveCurrency("XYZ", { fallbackDecimalPlaces: -1 })).toThrow(
			/Decimal places/,
		);
	});
});
