import { describe, expect, test } from "bun:test";
import { Currency, Money } from "../src";

const usd = (minor: number) => Money.fromMinor(Currency.USD, minor);

describe("Money.scaleByRatio", () => {
	test("computes money × numerator ÷ denominator", () => {
		expect(usd(4444).scaleByRatio(usd(1000), usd(3333)).toMinor()).toBe(1333);
		expect(usd(200).scaleByRatio(usd(1), usd(3)).toMinor()).toBe(67);
		expect(usd(100).scaleByRatio(usd(1), usd(3)).toMinor()).toBe(33);
	});

	test("static and instance forms agree", () => {
		const money = usd(4444);
		expect(Money.scaleByRatio(money, usd(1000), usd(3333)).toMinor()).toBe(
			money.scaleByRatio(usd(1000), usd(3333)).toMinor(),
		);
	});

	test("rounds the exact ratio once, where percentOf drifts", () => {
		const money = usd(123456789);
		const ratio = [usd(1), usd(6)] as const;
		expect(money.scaleByRatio(...ratio).toMinor()).toBe(20576132);
		expect(money.scaleByRatio(...ratio, { rounding: "round" }).toMinor()).toBe(
			20576132,
		);
		expect(money.scaleByRatio(...ratio, { rounding: "floor" }).toMinor()).toBe(
			20576131,
		);
		expect(money.scaleByRatio(...ratio, { rounding: "trunc" }).toMinor()).toBe(
			20576131,
		);
		expect(money.scaleByRatio(...ratio, { rounding: "ceil" }).toMinor()).toBe(
			20576132,
		);
	});

	test.each([
		["round", 3, -2],
		["floor", 2, -3],
		["ceil", 3, -2],
		["trunc", 2, -2],
	] as const)("halves with %s", (rounding, positive, negative) => {
		const half = [usd(1), usd(2), { rounding }] as const;
		expect(
			usd(5)
				.scaleByRatio(...half)
				.toMinor(),
		).toBe(positive);
		expect(
			usd(-5)
				.scaleByRatio(...half)
				.toMinor(),
		).toBe(negative);
	});

	test("a negative denominator flips the sign before rounding", () => {
		expect(usd(5).scaleByRatio(usd(-1), usd(2)).toMinor()).toBe(-2);
		expect(usd(5).scaleByRatio(usd(1), usd(-2)).toMinor()).toBe(-2);
		expect(usd(-5).scaleByRatio(usd(1), usd(-2)).toMinor()).toBe(3);
	});

	test.each([
		0,
		1,
		-1,
		4444,
		123456789,
		Number.MAX_SAFE_INTEGER,
	])("%p × d/d is unchanged and %p × 0/d is zero", (minor) => {
		expect(usd(minor).scaleByRatio(usd(3333), usd(3333)).toMinor()).toBe(minor);
		expect(usd(minor).scaleByRatio(usd(0), usd(3333)).isZero()).toBe(true);
	});

	test("works on 0-decimal currencies", () => {
		const jpy = Money.fromMinor(Currency.JPY, 1000);
		const result = jpy.scaleByRatio(
			Money.fromMinor(Currency.JPY, 1),
			Money.fromMinor(Currency.JPY, 3),
		);
		expect(result.toMinor()).toBe(333);
		expect(result.currency).toBe(Currency.JPY);
	});

	test("keeps the intermediate product exact past the safe range", () => {
		expect(
			usd(Number.MAX_SAFE_INTEGER).scaleByRatio(usd(1), usd(3)).toMinor(),
		).toBe(3002399751580330);
	});

	test("throws when the result exceeds the safe range", () => {
		expect(() =>
			usd(Number.MAX_SAFE_INTEGER).scaleByRatio(usd(2), usd(1)),
		).toThrow("Result too large");
	});

	test("throws on a zero denominator", () => {
		expect(() => usd(100).scaleByRatio(usd(1), usd(0))).toThrow(
			/zero denominator/,
		);
	});

	test("throws when numerator and denominator currencies differ", () => {
		const eur = Money.fromMinor(Currency.EUR, 1);
		expect(() => usd(100).scaleByRatio(eur, usd(2))).toThrow(
			/EUR.*USD.*currency mismatch/,
		);
	});

	test("the ratio currency may differ from the scaled money", () => {
		const eur = Money.fromMinor(Currency.EUR, 900);
		const result = eur.scaleByRatio(usd(1), usd(3));
		expect(result.toMinor()).toBe(300);
		expect(result.currency).toBe(Currency.EUR);
	});
});
