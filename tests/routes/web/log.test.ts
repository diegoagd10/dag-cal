import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createDataStore } from "../../../src/data/store.js";
import { createConsumptionLog } from "../../../src/modules/consumption-log.js";
import type { ConsumptionLog } from "../../../src/modules/consumption-log.types.js";
import { createDaySnapshot } from "../../../src/modules/day-snapshot.js";
import type { DaySnapshotReader } from "../../../src/modules/day-snapshot.types.js";
import type { FoodCatalog } from "../../../src/modules/food-catalog.js";
import { createFoodCatalog } from "../../../src/modules/food-catalog.js";
import { createLogRoutes } from "../../../src/routes/web/log.jsx";

interface Harness {
	app: ReturnType<typeof createLogRoutes>;
	catalog: FoodCatalog;
	log: ConsumptionLog;
	snapshot: DaySnapshotReader;
	store: ReturnType<typeof createDataStore>;
}

function harness(): Harness {
	const db = new Database(":memory:");
	const store = createDataStore(db);
	const catalog = createFoodCatalog(store);
	const log = createConsumptionLog(store);
	const snapshot = createDaySnapshot(store);
	const app = createLogRoutes(catalog, log, snapshot);
	return { app, catalog, log, snapshot, store };
}

function formPost(fields: Record<string, string>): {
	method: "POST";
	body: URLSearchParams;
	headers: Headers;
} {
	return {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: new Headers({
			"Content-Type": "application/x-www-form-urlencoded",
		}),
	};
}

describe("POST /days/:date/entries — weight unit conversion", () => {
	it("converts ounces to the Food's gram reference unit", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood({
			name: "Oatmeal",
			referencePortion: { value: 100, unit: "g" },
			nutrition: {
				calories: 389,
				protein: 16.9,
				carbs: 66.3,
				fat: 6.9,
				fiber: 10.6,
				sugar: 0,
				sodium: 0,
			},
		});

		const res = await app.request(
			"/2025-01-01/entries",
			formPost({
				foodId: food.id,
				quantity: "1",
				unit: "oz",
			}),
		);

		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/days/2025-01-01");
		const entries = log.listEntries("2025-01-01");
		expect(entries).toHaveLength(1);
		expect(entries[0].quantity).toBeCloseTo(28.349523125, 5);
	});

	it("keeps grams as-is when submitted in the reference unit", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood({
			name: "Rice",
			referencePortion: { value: 100, unit: "g" },
			nutrition: {
				calories: 130,
				protein: 2.7,
				carbs: 28,
				fat: 0.3,
				fiber: 0.4,
				sugar: 0,
				sodium: 1,
			},
		});

		await app.request(
			"/2025-01-01/entries",
			formPost({
				foodId: food.id,
				quantity: "100",
				unit: "g",
			}),
		);

		expect(log.listEntries("2025-01-01")[0].quantity).toBeCloseTo(100, 6);
	});

	it("converts grams to the Food's ounce reference unit", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood({
			name: "Cheese",
			referencePortion: { value: 1, unit: "oz" },
			nutrition: {
				calories: 110,
				protein: 7,
				carbs: 0.4,
				fat: 9,
				fiber: 0,
				sugar: 0.1,
				sodium: 175,
			},
		});

		await app.request(
			"/2025-01-01/entries",
			formPost({
				foodId: food.id,
				quantity: "28.3495",
				unit: "g",
			}),
		);

		expect(log.listEntries("2025-01-01")[0].quantity).toBeCloseTo(1, 4);
	});

	it("defaults to the reference unit when no unit is submitted (back-compat)", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood({
			name: "Yogurt",
			referencePortion: { value: 150, unit: "g" },
			nutrition: {
				calories: 90,
				protein: 17,
				carbs: 6,
				fat: 0.5,
				fiber: 0,
				sugar: 6,
				sodium: 60,
			},
		});

		await app.request(
			"/2025-01-01/entries",
			formPost({
				foodId: food.id,
				quantity: "150",
			}),
		);

		expect(log.listEntries("2025-01-01")[0].quantity).toBeCloseTo(150, 6);
	});

	it("treats count-based Foods as count only, ignoring any unit", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood({
			name: "Egg",
			referencePortion: { value: 1, unit: "unit" },
			nutrition: {
				calories: 78,
				protein: 6.3,
				carbs: 0.6,
				fat: 5.3,
				fiber: 0,
				sugar: 0.6,
				sodium: 62,
			},
		});

		await app.request(
			"/2025-01-01/entries",
			formPost({
				foodId: food.id,
				quantity: "2",
			}),
		);

		expect(log.listEntries("2025-01-01")[0].quantity).toBe(2);
	});

	it("re-renders the day with an error for a non-positive quantity", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood({
			name: "Oatmeal",
			referencePortion: { value: 100, unit: "g" },
			nutrition: {
				calories: 389,
				protein: 16.9,
				carbs: 66.3,
				fat: 6.9,
				fiber: 10.6,
				sugar: 0,
				sodium: 0,
			},
		});

		const res = await app.request(
			"/2025-01-01/entries",
			formPost({
				foodId: food.id,
				quantity: "0",
				unit: "g",
			}),
		);

		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("quantity must be a positive number");
		expect(log.listEntries("2025-01-01")).toHaveLength(0);
	});
});

describe("GET /days/:date — log form unit selector", () => {
	it("offers a g/oz unit selector for a weight-based Food", async () => {
		const { app, catalog } = harness();
		catalog.createFood({
			name: "Oatmeal",
			referencePortion: { value: 100, unit: "g" },
			nutrition: {
				calories: 389,
				protein: 16.9,
				carbs: 66.3,
				fat: 6.9,
				fiber: 10.6,
				sugar: 0,
				sodium: 0,
			},
		});

		const res = await app.request("/2025-01-01");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('name="unit"');
		expect(html).toContain('<option value="g"');
		expect(html).toContain('<option value="oz"');
	});

	it("omits the unit selector for a count-based Food", async () => {
		const { app, catalog } = harness();
		catalog.createFood({
			name: "Egg",
			referencePortion: { value: 1, unit: "unit" },
			nutrition: {
				calories: 78,
				protein: 6.3,
				carbs: 0.6,
				fat: 5.3,
				fiber: 0,
				sugar: 0.6,
				sodium: 62,
			},
		});

		const res = await app.request("/2025-01-01");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).not.toContain('name="unit"');
	});
});

describe("GET /days/:date — day snapshot view", () => {
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

	it("renders zero totals and an empty entries list for a day with nothing logged", async () => {
		const { app } = harness();

		const res = await app.request("/2025-01-01");
		expect(res.status).toBe(200);
		const html = await res.text();

		expect(html).toContain("Nothing logged yet.");
		expect(html).toContain("Day totals");
		expect(html).toMatch(/total-calories[^>]*>0<\/strong>/);
	});

	it("renders day totals and per-item contributions scaled by quantity", async () => {
		const { app, catalog, log } = harness();
		const oat = catalog.createFood(OATMEAL);
		const egg = catalog.createFood(EGG);
		log.logConsumption("2025-01-01", oat.id, 200); // 2× reference
		log.logConsumption("2025-01-01", egg.id, 2); // 2× reference

		const res = await app.request("/2025-01-01");
		expect(res.status).toBe(200);
		const html = await res.text();

		// Per-entry contributions visible.
		expect(html).toContain("Oatmeal");
		expect(html).toContain("Egg");
		expect(html).toContain(">778<"); // oat 2× calories
		expect(html).toContain(">156<"); // egg 2× calories

		// Day totals — calories = 389*2 + 78*2 = 934; protein = 16.9*2 + 6.3*2 = 46.4.
		expect(html).toMatch(/total-calories[^>]*>934<\/strong>/);
		expect(html).toMatch(/total-protein[^>]*>46.4 g</);
	});

	it("renders all seven per-entry macro contributions (calories/protein/carbs/fat/fiber/sugar/sodium)", async () => {
		const { app, catalog, log } = harness();
		const oat = catalog.createFood(OATMEAL);
		const egg = catalog.createFood(EGG);
		log.logConsumption("2025-01-01", oat.id, 200); // 2× reference
		log.logConsumption("2025-01-01", egg.id, 2); // 2× reference

		const res = await app.request("/2025-01-01");
		expect(res.status).toBe(200);
		const html = await res.text();

		// Oatmeal 2×: fiber 21.2g, sugar 0, sodium 0.
		expect(html).toContain('data-testid="entry-fiber">21.2');
		expect(html).toContain('data-testid="entry-sugar">0');
		expect(html).toContain('data-testid="entry-sodium">0');
		// Egg 2×: fiber 0, sugar 1.2, sodium 124.
		expect(html).toContain('data-testid="entry-fiber">0');
		expect(html).toContain('data-testid="entry-sugar">1.2');
		expect(html).toContain('data-testid="entry-sodium">124');
	});

	it("provides previous/next day navigation links", async () => {
		const { app } = harness();

		const res = await app.request("/2025-01-15");
		const html = await res.text();

		expect(html).toContain('href="/days/2025-01-14"');
		expect(html).toContain('href="/days/2025-01-16"');
	});

	it("navigates across month and year boundaries", async () => {
		const { app } = harness();

		expect(await (await app.request("/2025-01-01")).text()).toContain(
			'href="/days/2024-12-31"',
		);
		expect(await (await app.request("/2025-12-31")).text()).toContain(
			'href="/days/2026-01-01"',
		);
	});

	it("reflects an edited Food's new nutrition in a past day's totals", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood(OATMEAL);
		log.logConsumption("2025-01-01", food.id, 100);

		let html = await (await app.request("/2025-01-01")).text();
		expect(html).toMatch(/total-calories[^>]*>389<\/strong>/);

		catalog.updateFood(food.id, {
			nutrition: { ...OATMEAL.nutrition, calories: 500 },
		});

		html = await (await app.request("/2025-01-01")).text();
		expect(html).toMatch(/total-calories[^>]*>500<\/strong>/);
	});

	it("shows an archived Food's name in the snapshot of a day that references it", async () => {
		const { app, catalog, log, store } = harness();
		const food = catalog.createFood(OATMEAL);
		log.logConsumption("2025-01-01", food.id, 100);
		// Archival isn't on the FoodCatalog interface yet (#5); archive via the store.
		store.updateFood(food.id, { archived: true, name: "Archived Oatmeal" });

		const html = await (await app.request("/2025-01-01")).text();
		expect(html).toContain("Archived Oatmeal");
		expect(html).toMatch(/total-calories[^>]*>389<\/strong>/);
	});
});
