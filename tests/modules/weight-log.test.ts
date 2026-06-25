import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createDataStore } from "../../src/data/store.js";
import { createWeightLog } from "../../src/modules/weight-log.js";
import type { WeightLog } from "../../src/modules/weight-log.types.js";
import { ValidationError } from "../../src/modules/weight-log.types.js";

const LB_PER_KG = 2.20462;

function fresh(): WeightLog {
	const db = new Database(":memory:");
	const store = createDataStore(db);
	return createWeightLog(store);
}

describe("WeightLog", () => {
	it("returns undefined for a day with no weight recorded", () => {
		const weight = fresh();

		expect(weight.getWeight("2025-01-01", "kg")).toBeUndefined();
		expect(weight.getWeight("2025-01-01", "lb")).toBeUndefined();
	});

	it("stores a kg value and returns it in kg", () => {
		const weight = fresh();

		const result = weight.recordWeight("2025-01-01", 80, "kg");

		expect(result).toEqual({ date: "2025-01-01", value: 80, unit: "kg" });
		expect(weight.getWeight("2025-01-01", "kg")).toEqual({
			date: "2025-01-01",
			value: 80,
			unit: "kg",
		});
	});

	it("stores a lb value canonically as kg and returns it in lb", () => {
		const weight = fresh();

		weight.recordWeight("2025-01-01", 176.37, "lb");

		const reading = weight.getWeight("2025-01-01", "lb");
		expect(reading).not.toBeUndefined();
		expect(reading?.unit).toBe("lb");
		expect(reading?.value).toBeCloseTo(176.37, 2);
	});

	it("round-trips kg → lb → kg without losing substance", () => {
		const weight = fresh();
		const original = 80;

		weight.recordWeight("2025-01-01", original, "kg");
		const inLb = weight.getWeight("2025-01-01", "lb");
		if (inLb === undefined) throw new Error("expected a reading");
		weight.recordWeight("2025-01-02", inLb.value, "lb");

		expect(weight.getWeight("2025-01-02", "kg")?.value).toBeCloseTo(
			original,
			6,
		);
	});

	it("converts kg to lb on read using 1 kg = 2.20462 lb", () => {
		const weight = fresh();
		weight.recordWeight("2025-01-01", 80, "kg");

		expect(weight.getWeight("2025-01-01", "lb")?.value).toBeCloseTo(
			80 * LB_PER_KG,
			5,
		);
	});

	it("converts lb to kg on read using 1 kg = 2.20462 lb", () => {
		const weight = fresh();
		weight.recordWeight("2025-01-01", 176.37, "lb");

		expect(weight.getWeight("2025-01-01", "kg")?.value).toBeCloseTo(80, 1);
	});

	it("a second record for the same day overwrites the first", () => {
		const weight = fresh();
		weight.recordWeight("2025-01-01", 80, "kg");
		weight.recordWeight("2025-01-01", 79.5, "kg");

		expect(weight.getWeight("2025-01-01", "kg")).toEqual({
			date: "2025-01-01",
			value: 79.5,
			unit: "kg",
		});
	});

	it("keeps each day's weight independent", () => {
		const weight = fresh();
		weight.recordWeight("2025-01-01", 80, "kg");
		weight.recordWeight("2025-01-02", 79.5, "kg");

		expect(weight.getWeight("2025-01-01", "kg")?.value).toBe(80);
		expect(weight.getWeight("2025-01-02", "kg")?.value).toBe(79.5);
	});

	it("returns the value in the requested unit, independent of how it was stored", () => {
		const weight = fresh();
		weight.recordWeight("2025-01-01", 176.37, "lb");

		const inKg = weight.getWeight("2025-01-01", "kg");
		const inLb = weight.getWeight("2025-01-01", "lb");
		expect(inKg?.value).toBeCloseTo(80, 1);
		expect(inLb?.value).toBeCloseTo(176.37, 2);
	});

	it("rejects a malformed date", () => {
		const weight = fresh();

		expect(() => weight.recordWeight("2025-1-1", 80, "kg")).toThrow(
			ValidationError,
		);
		expect(() => weight.getWeight("not-a-date", "kg")).toThrow(ValidationError);
	});

	it("rejects zero, negative, NaN, and Infinity values", () => {
		const weight = fresh();

		expect(() => weight.recordWeight("2025-01-01", 0, "kg")).toThrow(
			ValidationError,
		);
		expect(() => weight.recordWeight("2025-01-01", -80, "kg")).toThrow(
			ValidationError,
		);
		expect(() => weight.recordWeight("2025-01-01", Number.NaN, "kg")).toThrow(
			ValidationError,
		);
		expect(() =>
			weight.recordWeight("2025-01-01", Number.POSITIVE_INFINITY, "kg"),
		).toThrow(ValidationError);
	});

	it("rejects an unknown unit", () => {
		const weight = fresh();

		// @ts-expect-error runtime guard against an invalid unit
		expect(() => weight.recordWeight("2025-01-01", 80, "st")).toThrow(
			ValidationError,
		);
		// @ts-expect-error runtime guard against an invalid unit
		expect(() => weight.getWeight("2025-01-01", "st")).toThrow(ValidationError);
	});
});
