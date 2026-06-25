import { describe, expect, it } from "vitest";
import { convertWeight, UnitConversionError } from "../../src/modules/units.js";

describe("convertWeight", () => {
	it("converts ounces to grams", () => {
		expect(convertWeight(1, "oz", "g")).toBeCloseTo(28.349523125, 6);
	});

	it("converts grams to ounces", () => {
		expect(convertWeight(100, "g", "oz")).toBeCloseTo(3.527396195, 5);
	});

	it("returns the value unchanged when units match", () => {
		expect(convertWeight(42, "g", "g")).toBe(42);
		expect(convertWeight(2.5, "oz", "oz")).toBe(2.5);
	});

	it("round-trips g → oz → g without losing substance", () => {
		const original = 250;
		const roundTrip = convertWeight(
			convertWeight(original, "g", "oz"),
			"oz",
			"g",
		);
		expect(roundTrip).toBeCloseTo(original, 6);
	});

	it("converts zero (pure math; sign is the caller's concern)", () => {
		expect(convertWeight(0, "g", "oz")).toBe(0);
	});

	it("rejects NaN and Infinity", () => {
		expect(() => convertWeight(Number.NaN, "g", "oz")).toThrow(
			UnitConversionError,
		);
		expect(() => convertWeight(Number.POSITIVE_INFINITY, "oz", "g")).toThrow(
			UnitConversionError,
		);
	});
});
