import { describe, expect, test } from "bun:test";
import { Currency, Money } from "../src";

describe("Money.round", () => {
	describe("rounding to nearest cent (0.01)", () => {
		test("rounds down when below half", () => {
			const money = Money.fromMinor(Currency.USDH, 1234); // $1.234
			const rounded = money.round(0.01);
			expect(rounded.toNumber()).toBe(1.23);
		});

		test("rounds up when at or above half", () => {
			const money = Money.fromMinor(Currency.USDH, 1235); // $1.235
			const rounded = money.round(0.01);
			expect(rounded.toNumber()).toBe(1.24);
		});

		test("leaves exact cent values unchanged", () => {
			const money = Money.fromMinor(Currency.USDH, 1230); // $1.230
			const rounded = money.round(0.01);
			expect(rounded.toNumber()).toBe(1.23);
		});
	});

	describe("rounding to nearest nickel (0.05)", () => {
		test("rounds $1.23 to $1.25", () => {
			const money = Money.fromNumber(Currency.USD, 1.23);
			const rounded = money.round(0.05);
			expect(rounded.toNumber()).toBe(1.25);
		});

		test("rounds $1.22 to $1.20", () => {
			const money = Money.fromNumber(Currency.USD, 1.22);
			const rounded = money.round(0.05);
			expect(rounded.toNumber()).toBe(1.2);
		});

		test("rounds $1.27 to $1.25", () => {
			const money = Money.fromNumber(Currency.USD, 1.27);
			const rounded = money.round(0.05);
			expect(rounded.toNumber()).toBe(1.25);
		});

		test("rounds $1.28 to $1.30", () => {
			const money = Money.fromNumber(Currency.USD, 1.28);
			const rounded = money.round(0.05);
			expect(rounded.toNumber()).toBe(1.3);
		});

		test("leaves exact nickel values unchanged", () => {
			const money = Money.fromNumber(Currency.USD, 1.25);
			const rounded = money.round(0.05);
			expect(rounded.toNumber()).toBe(1.25);
		});
	});

	describe("rounding to nearest dime (0.10)", () => {
		test("rounds $1.24 to $1.20", () => {
			const money = Money.fromNumber(Currency.USD, 1.24);
			const rounded = money.round(0.1);
			expect(rounded.toNumber()).toBe(1.2);
		});

		test("rounds $1.25 to $1.30", () => {
			const money = Money.fromNumber(Currency.USD, 1.25);
			const rounded = money.round(0.1);
			expect(rounded.toNumber()).toBe(1.3);
		});

		test("rounds $1.26 to $1.30", () => {
			const money = Money.fromNumber(Currency.USD, 1.26);
			const rounded = money.round(0.1);
			expect(rounded.toNumber()).toBe(1.3);
		});
	});

	describe("rounding to nearest quarter (0.25)", () => {
		test("rounds $1.10 to $1.00", () => {
			const money = Money.fromNumber(Currency.USD, 1.1);
			const rounded = money.round(0.25);
			expect(rounded.toNumber()).toBe(1.0);
		});

		test("rounds $1.13 to $1.25", () => {
			const money = Money.fromNumber(Currency.USD, 1.13);
			const rounded = money.round(0.25);
			expect(rounded.toNumber()).toBe(1.25);
		});

		test("rounds $1.37 to $1.25", () => {
			const money = Money.fromNumber(Currency.USD, 1.37);
			const rounded = money.round(0.25);
			expect(rounded.toNumber()).toBe(1.25);
		});

		test("rounds $1.38 to $1.50", () => {
			const money = Money.fromNumber(Currency.USD, 1.38);
			const rounded = money.round(0.25);
			expect(rounded.toNumber()).toBe(1.5);
		});

		test("leaves exact quarter values unchanged", () => {
			const money = Money.fromNumber(Currency.USD, 1.75);
			const rounded = money.round(0.25);
			expect(rounded.toNumber()).toBe(1.75);
		});
	});

	describe("rounding to nearest dollar (1.00)", () => {
		test("rounds $1.49 to $1.00", () => {
			const money = Money.fromNumber(Currency.USD, 1.49);
			const rounded = money.round(1);
			expect(rounded.toNumber()).toBe(1.0);
		});

		test("rounds $1.50 to $2.00", () => {
			const money = Money.fromNumber(Currency.USD, 1.5);
			const rounded = money.round(1);
			expect(rounded.toNumber()).toBe(2.0);
		});

		test("rounds $1.51 to $2.00", () => {
			const money = Money.fromNumber(Currency.USD, 1.51);
			const rounded = money.round(1);
			expect(rounded.toNumber()).toBe(2.0);
		});

		test("leaves exact dollar values unchanged", () => {
			const money = Money.fromNumber(Currency.USD, 5.0);
			const rounded = money.round(1);
			expect(rounded.toNumber()).toBe(5.0);
		});
	});

	describe("rounding modes", () => {
		describe("floor mode", () => {
			test("always rounds down to nearest increment", () => {
				const money = Money.fromNumber(Currency.USD, 1.27);
				const rounded = money.round(0.25, "floor");
				expect(rounded.toNumber()).toBe(1.25);
			});

			test("rounds down even when very close to next increment", () => {
				const money = Money.fromNumber(Currency.USD, 1.49);
				const rounded = money.round(0.25, "floor");
				expect(rounded.toNumber()).toBe(1.25);
			});

			test("leaves exact values unchanged", () => {
				const money = Money.fromNumber(Currency.USD, 1.5);
				const rounded = money.round(0.25, "floor");
				expect(rounded.toNumber()).toBe(1.5);
			});
		});

		describe("ceil mode", () => {
			test("always rounds up to nearest increment", () => {
				const money = Money.fromNumber(Currency.USD, 1.26);
				const rounded = money.round(0.25, "ceil");
				expect(rounded.toNumber()).toBe(1.5);
			});

			test("rounds up even when very close to current increment", () => {
				const money = Money.fromNumber(Currency.USD, 1.01);
				const rounded = money.round(0.25, "ceil");
				expect(rounded.toNumber()).toBe(1.25);
			});

			test("leaves exact values unchanged", () => {
				const money = Money.fromNumber(Currency.USD, 1.25);
				const rounded = money.round(0.25, "ceil");
				expect(rounded.toNumber()).toBe(1.25);
			});
		});

		describe("trunc mode", () => {
			test("rounds positive values toward zero", () => {
				const money = Money.fromNumber(Currency.USD, 1.99);
				const rounded = money.round(1, "trunc");
				expect(rounded.toNumber()).toBe(1.0);
			});

			test("rounds negative values toward zero", () => {
				const money = Money.fromNumber(Currency.USD, -1.99);
				const rounded = money.round(1, "trunc");
				expect(rounded.toNumber()).toBe(-1.0);
			});
		});

		describe("round mode (default)", () => {
			test("rounds to nearest, half up", () => {
				const money = Money.fromNumber(Currency.USD, 1.125);
				const rounded = money.round(0.25, "round");
				expect(rounded.toNumber()).toBe(1.25);
			});
		});
	});

	describe("negative values", () => {
		test("rounds negative value to nearest nickel", () => {
			const money = Money.fromNumber(Currency.USD, -1.23);
			const rounded = money.round(0.05);
			expect(rounded.toNumber()).toBe(-1.25);
		});

		test("rounds negative value to nearest quarter", () => {
			const money = Money.fromNumber(Currency.USD, -1.1);
			const rounded = money.round(0.25);
			expect(rounded.toNumber()).toBe(-1.0);
		});

		test("rounds negative value to nearest dollar", () => {
			const money = Money.fromNumber(Currency.USD, -1.6);
			const rounded = money.round(1);
			expect(rounded.toNumber()).toBe(-2.0);
		});

		test("floor rounds negative away from zero", () => {
			const money = Money.fromNumber(Currency.USD, -1.1);
			const rounded = money.round(0.25, "floor");
			expect(rounded.toNumber()).toBe(-1.25);
		});

		test("ceil rounds negative toward zero", () => {
			const money = Money.fromNumber(Currency.USD, -1.1);
			const rounded = money.round(0.25, "ceil");
			expect(rounded.toNumber()).toBe(-1.0);
		});
	});

	describe("zero handling", () => {
		test("zero rounds to zero for any increment", () => {
			const money = Money.fromNumber(Currency.USD, 0);
			expect(money.round(0.01).toNumber()).toBe(0);
			expect(money.round(0.05).toNumber()).toBe(0);
			expect(money.round(0.25).toNumber()).toBe(0);
			expect(money.round(1).toNumber()).toBe(0);
		});
	});

	describe("currency preservation", () => {
		test("preserves USD currency", () => {
			const money = Money.fromNumber(Currency.USD, 1.23);
			const rounded = money.round(0.05);
			expect(rounded.toMinor()).toBe(125); // 125 cents
		});

		test("preserves EUR currency", () => {
			const money = Money.fromNumber(Currency.EUR, 1.23);
			const rounded = money.round(0.05);
			expect(rounded.toMinor()).toBe(125);
		});

		test("works with JPY (no decimals)", () => {
			const money = Money.fromNumber(Currency.JPY, 123);
			const rounded = money.round(10);
			expect(rounded.toNumber()).toBe(120);
		});

		test("works with BTC (8 decimals)", () => {
			const money = Money.fromNumber(Currency.BTC, 0.12345678);
			const rounded = money.round(0.001);
			expect(rounded.toNumber()).toBe(0.123);
		});
	});

	describe("edge cases", () => {
		test("increments that are not exact minor units throw", () => {
			const money = Money.fromNumber(Currency.USD, 1.23);
			expect(() => money.round(0.015)).toThrow();
		});

		test("tiny changes in increment that break minor units throw", () => {
			const money = Money.fromNumber(Currency.USD, 1.23);
			expect(() => money.round(0.014)).toThrow();
			expect(() => money.round(0.015)).toThrow();
		});

		test("JPY rejects increments with decimals", () => {
			const money = Money.fromNumber(Currency.JPY, 123);
			expect(() => money.round(0.5)).toThrow();
			expect(() => money.round(0.01)).toThrow();
		});

		test("BTC rejects increments that exceed 8 decimals", () => {
			const money = Money.fromNumber(Currency.BTC, 0.12345678);
			expect(() => money.round(0.000000001)).toThrow();
			expect(() => money.round(0.000000015)).toThrow();
		});

		test("BTC accepts 8-decimal increments", () => {
			const money = Money.fromNumber(Currency.BTC, 0.12345678);
			const rounded = money.round(0.00000001);
			expect(rounded.toNumber()).toBe(0.12345678);
		});

		test("rounding increment of 0 throws error", () => {
			const money = Money.fromNumber(Currency.USD, 1.23);
			expect(() => money.round(0)).toThrow();
		});

		test("negative rounding increment throws error", () => {
			const money = Money.fromNumber(Currency.USD, 1.23);
			expect(() => money.round(-0.05)).toThrow();
		});

		test("handles large values", () => {
			const money = Money.fromNumber(Currency.USD, 999999.99);
			const rounded = money.round(1);
			expect(rounded.toNumber()).toBe(1000000);
		});

		test("handles very small increments for high-precision currencies", () => {
			const money = Money.fromNumber(Currency.BTC, 0.123456789);
			const rounded = money.round(0.00000001);
			expect(rounded.toNumber()).toBe(0.12345679);
		});
	});

	describe("immutability", () => {
		test("round returns a new Money instance", () => {
			const original = Money.fromNumber(Currency.USD, 1.23);
			const rounded = original.round(0.05);
			expect(original.toNumber()).toBe(1.23);
			expect(rounded.toNumber()).toBe(1.25);
			expect(original).not.toBe(rounded);
		});
	});
});

describe("Money.roundTo static method", () => {
	test("static method works same as instance method", () => {
		const money = Money.fromNumber(Currency.USD, 1.23);
		const rounded1 = money.round(0.05);
		const rounded2 = Money.roundTo(money, 0.05);
		expect(rounded1.toNumber()).toBe(rounded2.toNumber());
	});

	test("static method accepts rounding mode", () => {
		const money = Money.fromNumber(Currency.USD, 1.23);
		const rounded = Money.roundTo(money, 0.25, "floor");
		expect(rounded.toNumber()).toBe(1.0);
	});
});

describe('"round" mode resolves exact halves toward +Infinity', () => {
	test.each([
		[5, 3],
		[-5, -2],
		[15, 8],
		[-15, -7],
	])("%p × 50%% → %p", (minor, expected) => {
		expect(Money.fromMinor(Currency.USD, minor).percentOf(50).toMinor()).toBe(
			expected,
		);
	});

	test("fromNumber and round follow the same rule", () => {
		expect(Money.fromNumber(Currency.USD, 0.025).toMinor()).toBe(3);
		expect(Money.fromNumber(Currency.USD, -0.025).toMinor()).toBe(-2);
		expect(Money.fromMinor(Currency.USD, 125).round(0.1).toMinor()).toBe(130);
		expect(Money.fromMinor(Currency.USD, -125).round(0.1).toMinor()).toBe(-120);
	});
});
