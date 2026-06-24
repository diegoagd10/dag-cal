import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createDataStore } from "../../src/data/store.js";
import { createConsumptionLog } from "../../src/modules/consumption-log.js";
import { createDaySnapshot } from "../../src/modules/day-snapshot.js";
import type { DaySnapshot } from "../../src/modules/day-snapshot.types.js";
import { createFoodCatalog } from "../../src/modules/food-catalog.js";

interface Fresh {
	snapshot: ReturnType<typeof createDaySnapshot>;
	catalog: ReturnType<typeof createFoodCatalog>;
	log: ReturnType<typeof createConsumptionLog>;
	store: ReturnType<typeof createDataStore>;
}

function fresh(): Fresh {
	const db = new Database(":memory:");
	const store = createDataStore(db);
	const catalog = createFoodCatalog(store);
	const log = createConsumptionLog(store);
	const snapshot = createDaySnapshot(store);
	return { snapshot, catalog, log, store };
}

const OATMEAL = {
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

const EGG = {
	name: "Egg",
	referencePortion: { value: 1, unit: "unit" as const },
	nutrition: {
		calories: 78,
		protein: 6.3,
		carbs: 0.6,
		fat: 5.3,
		fiber: 0,
		sugar: 0.6,
		sodium: 62,
	},
};

function zeroTotals() {
	return {
		calories: 0,
		protein: 0,
		carbs: 0,
		fat: 0,
		fiber: 0,
		sugar: 0,
		sodium: 0,
	};
}

describe("DaySnapshot", () => {
	it("returns zero totals and no entries for an empty day", () => {
		const { snapshot } = fresh();

		const snap: DaySnapshot = snapshot.getDaySnapshot("2025-01-01");

		expect(snap.date).toBe("2025-01-01");
		expect(snap.entries).toEqual([]);
		expect(snap.totals).toEqual(zeroTotals());
	});

	it("scales each entry's macros by quantity / reference portion value", () => {
		const { snapshot, catalog, log } = fresh();
		const food = catalog.createFood(OATMEAL); // ref 100 g
		log.logConsumption("2025-01-01", food.id, 200); // double the reference

		const snap = snapshot.getDaySnapshot("2025-01-01");

		expect(snap.entries).toHaveLength(1);
		expect(snap.entries[0].food.id).toBe(food.id);
		expect(snap.entries[0].macros).toEqual({
			calories: 389 * 2,
			protein: 16.9 * 2,
			carbs: 66.3 * 2,
			fat: 6.9 * 2,
			fiber: 10.6 * 2,
			sugar: 0,
			sodium: 0,
		});
	});

	it("scales count-based foods by the count / reference count", () => {
		const { snapshot, catalog, log } = fresh();
		const egg = catalog.createFood(EGG); // ref 1 unit
		log.logConsumption("2025-01-01", egg.id, 2);

		const snap = snapshot.getDaySnapshot("2025-01-01");

		expect(snap.entries[0].macros.calories).toBeCloseTo(156, 6);
		expect(snap.entries[0].macros.protein).toBeCloseTo(12.6, 6);
	});

	it("totals are the component-wise sum of all entry macros", () => {
		const { snapshot, catalog, log } = fresh();
		const oat = catalog.createFood(OATMEAL);
		const egg = catalog.createFood(EGG);
		log.logConsumption("2025-01-01", oat.id, 100); // 1× ref
		log.logConsumption("2025-01-01", egg.id, 2); // 2× ref

		const snap = snapshot.getDaySnapshot("2025-01-01");

		expect(snap.totals).toEqual({
			calories: 389 + 156,
			protein: 16.9 + 12.6,
			carbs: 66.3 + 1.2,
			fat: 6.9 + 10.6,
			fiber: 10.6 + 0,
			sugar: 0 + 1.2,
			sodium: 0 + 124,
		});
	});

	it("propagates Food edits into past days (live reference, no stored total)", () => {
		const { snapshot, catalog, log } = fresh();
		const food = catalog.createFood(OATMEAL);
		log.logConsumption("2025-01-01", food.id, 100);

		expect(snapshot.getDaySnapshot("2025-01-01").totals.calories).toBe(389);

		catalog.updateFood(food.id, {
			nutrition: { ...OATMEAL.nutrition, calories: 500 },
		});

		expect(snapshot.getDaySnapshot("2025-01-01").totals.calories).toBe(500);
		expect(
			snapshot.getDaySnapshot("2025-01-01").entries[0].macros.calories,
		).toBe(500);
	});

	it("resolves an archived Food in the snapshot of days that reference it", () => {
		const { snapshot, catalog, log, store } = fresh();
		const food = catalog.createFood(OATMEAL);
		log.logConsumption("2025-01-01", food.id, 100);
		store.updateFood(food.id, { archived: true });

		const snap = snapshot.getDaySnapshot("2025-01-01");

		expect(snap.entries).toHaveLength(1);
		expect(snap.entries[0].food.id).toBe(food.id);
		expect(snap.entries[0].food.archived).toBe(true);
		expect(snap.totals.calories).toBe(389);
	});
});
