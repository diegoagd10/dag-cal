import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createDataStore } from "../../src/data/store.js";
import { createHydrationLog } from "../../src/modules/hydration-log.js";
import type { HydrationLog } from "../../src/modules/hydration-log.types.js";
import { ValidationError } from "../../src/modules/hydration-log.types.js";

function fresh(): HydrationLog {
	const db = new Database(":memory:");
	const store = createDataStore(db);
	return createHydrationLog(store);
}

describe("HydrationLog", () => {
	it("returns ounces 0 for a day with no water recorded", () => {
		const hydration = fresh();

		const result = hydration.getWater("2025-01-01");

		expect(result).toEqual({ date: "2025-01-01", ounces: 0 });
	});

	it("adjustWater adds a positive delta and returns the new total", () => {
		const hydration = fresh();

		const result = hydration.adjustWater("2025-01-01", 8);

		expect(result).toEqual({ date: "2025-01-01", ounces: 8 });
		expect(hydration.getWater("2025-01-01").ounces).toBe(8);
	});

	it("adjustWater subtracts a negative delta", () => {
		const hydration = fresh();
		hydration.adjustWater("2025-01-01", 16);

		const result = hydration.adjustWater("2025-01-01", -8);

		expect(result.ounces).toBe(8);
		expect(hydration.getWater("2025-01-01").ounces).toBe(8);
	});

	it("clamps at 0 when a subtraction would go negative", () => {
		const hydration = fresh();
		hydration.adjustWater("2025-01-01", 8);

		const result = hydration.adjustWater("2025-01-01", -20);

		expect(result.ounces).toBe(0);
		expect(hydration.getWater("2025-01-01").ounces).toBe(0);
	});

	it("clamps at 0 when subtracting from an empty day", () => {
		const hydration = fresh();

		const result = hydration.adjustWater("2025-01-01", -8);

		expect(result.ounces).toBe(0);
		expect(result.date).toBe("2025-01-01");
	});

	it("accumulates the running total across multiple presses", () => {
		const hydration = fresh();

		hydration.adjustWater("2025-01-01", 8); // glass
		hydration.adjustWater("2025-01-01", 16); // bottle
		hydration.adjustWater("2025-01-01", 8); // glass

		expect(hydration.getWater("2025-01-01").ounces).toBe(32);
	});

	it("persists only the running total — no per-press events", () => {
		const hydration = fresh();

		hydration.adjustWater("2025-01-01", 8);
		hydration.adjustWater("2025-01-01", 16);
		hydration.adjustWater("2025-01-01", -8);

		// The day holds a single row with the running total, not three events.
		expect(hydration.getWater("2025-01-01").ounces).toBe(16);
	});

	it("keeps each day's total independent", () => {
		const hydration = fresh();
		hydration.adjustWater("2025-01-01", 8);
		hydration.adjustWater("2025-01-02", 16);

		expect(hydration.getWater("2025-01-01").ounces).toBe(8);
		expect(hydration.getWater("2025-01-02").ounces).toBe(16);
	});

	it("treats a zero delta as a no-op that still returns the current total", () => {
		const hydration = fresh();
		hydration.adjustWater("2025-01-01", 16);

		const result = hydration.adjustWater("2025-01-01", 0);

		expect(result.ounces).toBe(16);
		expect(hydration.getWater("2025-01-01").ounces).toBe(16);
	});

	it("rejects a malformed date", () => {
		const hydration = fresh();

		expect(() => hydration.adjustWater("2025-1-1", 8)).toThrow(ValidationError);
		expect(() => hydration.getWater("not-a-date")).toThrow(ValidationError);
	});

	it("rejects NaN and Infinity deltas", () => {
		const hydration = fresh();

		expect(() => hydration.adjustWater("2025-01-01", Number.NaN)).toThrow(
			ValidationError,
		);
		expect(() =>
			hydration.adjustWater("2025-01-01", Number.POSITIVE_INFINITY),
		).toThrow(ValidationError);
	});
});
