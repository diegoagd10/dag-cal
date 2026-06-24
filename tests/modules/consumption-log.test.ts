import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createDataStore } from "../../src/data/store.js";
import { createConsumptionLog } from "../../src/modules/consumption-log.js";
import type { ConsumptionLog } from "../../src/modules/consumption-log.types.js";
import {
	FoodArchivedError,
	FoodNotFoundError,
	LogEntryNotFoundError,
	ValidationError,
} from "../../src/modules/consumption-log.types.js";
import { createFoodCatalog } from "../../src/modules/food-catalog.js";
import type { FoodId } from "../../src/modules/food-catalog.types.js";

const validFood = {
	name: "Oatmeal",
	referencePortion: { value: 100, unit: "g" as const },
	nutrition: {
		calories: 389,
		protein: 16.9,
		carbs: 66.3,
		fat: 6.9,
		fiber: 10.6,
		sugar: 0,
		sodium: 0,
	},
};

interface Fresh {
	log: ConsumptionLog;
	catalog: ReturnType<typeof createFoodCatalog>;
	store: ReturnType<typeof createDataStore>;
}

function fresh(): Fresh {
	const db = new Database(":memory:");
	const store = createDataStore(db);
	const catalog = createFoodCatalog(store);
	const log = createConsumptionLog(store);
	return { log, catalog, store };
}

describe("ConsumptionLog", () => {
	describe("logConsumption", () => {
		it("creates an entry for an active Food with a decimal quantity", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);

			const entry = log.logConsumption("2025-01-01", food.id, 0.5);

			expect(entry.id).toBeTypeOf("string");
			expect(entry.id.length).toBeGreaterThan(0);
			expect(entry.date).toBe("2025-01-01");
			expect(entry.foodId).toBe(food.id);
			expect(entry.quantity).toBe(0.5);
		});

		it("throws FoodNotFound when the Food does not exist", () => {
			const { log } = fresh();
			expect(() =>
				log.logConsumption("2025-01-01", "nope" as FoodId, 1),
			).toThrow(FoodNotFoundError);
		});

		it("throws FoodArchived when the Food is archived", () => {
			// Archival is not exposed on the FoodCatalog interface yet (#5),
			// so we archive directly through the store — the live reference is
			// still resolvable, but logConsumption must reject it.
			const { log, catalog, store } = fresh();
			const food = catalog.createFood(validFood);
			store.updateFood(food.id, { archived: true });

			expect(() => log.logConsumption("2025-01-01", food.id, 1)).toThrow(
				FoodArchivedError,
			);
		});

		it("rejects zero quantity", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);

			expect(() => log.logConsumption("2025-01-01", food.id, 0)).toThrow(
				ValidationError,
			);
		});

		it("rejects negative quantity", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);

			expect(() => log.logConsumption("2025-01-01", food.id, -2)).toThrow(
				ValidationError,
			);
		});

		it("rejects NaN and Infinity", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);

			expect(() =>
				log.logConsumption("2025-01-01", food.id, Number.NaN),
			).toThrow(ValidationError);
			expect(() =>
				log.logConsumption("2025-01-01", food.id, Number.POSITIVE_INFINITY),
			).toThrow(ValidationError);
		});

		it("rejects a malformed date", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);

			expect(() => log.logConsumption("2025-1-1", food.id, 1)).toThrow(
				ValidationError,
			);
			expect(() => log.logConsumption("not-a-date", food.id, 1)).toThrow(
				ValidationError,
			);
		});

		it("allows the same Food to be logged multiple times on the same day", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);

			const a = log.logConsumption("2025-01-01", food.id, 1);
			const b = log.logConsumption("2025-01-01", food.id, 2);

			expect(a.id).not.toBe(b.id);
			expect(log.listEntries("2025-01-01")).toHaveLength(2);
		});

		it("persists so listEntries returns the logged entry", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);

			log.logConsumption("2025-01-01", food.id, 1.5);

			const entries = log.listEntries("2025-01-01");
			expect(entries).toHaveLength(1);
			expect(entries[0].quantity).toBe(1.5);
			expect(entries[0].foodId).toBe(food.id);
		});
	});

	describe("updateLogEntry", () => {
		it("changes the quantity of an existing entry", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);
			const entry = log.logConsumption("2025-01-01", food.id, 1);

			const updated = log.updateLogEntry(entry.id, 3);

			expect(updated.id).toBe(entry.id);
			expect(updated.quantity).toBe(3);
			expect(updated.date).toBe(entry.date);
			expect(updated.foodId).toBe(entry.foodId);
			expect(log.listEntries("2025-01-01")[0].quantity).toBe(3);
		});

		it("throws LogEntryNotFound for a non-existent id", () => {
			const { log } = fresh();
			expect(() => log.updateLogEntry("nope" as never, 2)).toThrow(
				LogEntryNotFoundError,
			);
		});

		it("rejects an invalid quantity", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);
			const entry = log.logConsumption("2025-01-01", food.id, 1);

			expect(() => log.updateLogEntry(entry.id, 0)).toThrow(ValidationError);
		});
	});

	describe("removeLogEntry", () => {
		it("deletes an existing entry", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);
			const entry = log.logConsumption("2025-01-01", food.id, 1);

			log.removeLogEntry(entry.id);

			expect(log.listEntries("2025-01-01")).toHaveLength(0);
		});

		it("is a silent no-op for a missing id", () => {
			const { log } = fresh();
			expect(() => log.removeLogEntry("nope")).not.toThrow();
		});
	});

	describe("listEntries", () => {
		it("returns only the entries logged on the given date", () => {
			const { log, catalog } = fresh();
			const food = catalog.createFood(validFood);

			log.logConsumption("2025-01-01", food.id, 1);
			log.logConsumption("2025-01-02", food.id, 2);
			log.logConsumption("2025-01-01", food.id, 3);

			const entries = log.listEntries("2025-01-01");
			expect(entries).toHaveLength(2);
			expect(entries.every((e) => e.date === "2025-01-01")).toBe(true);
		});

		it("returns [] for a date with no entries", () => {
			const { log } = fresh();
			expect(log.listEntries("2030-05-05")).toEqual([]);
		});
	});
});
