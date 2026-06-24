import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createDataStore } from "../../../src/data/store.js";
import { createConsumptionLog } from "../../../src/modules/consumption-log.js";
import type { ConsumptionLog } from "../../../src/modules/consumption-log.types.js";
import type { FoodCatalog } from "../../../src/modules/food-catalog.js";
import { createFoodCatalog } from "../../../src/modules/food-catalog.js";
import { createFoodsRoutes } from "../../../src/routes/web/foods.jsx";

interface Harness {
	app: ReturnType<typeof createFoodsRoutes>;
	catalog: FoodCatalog;
	log: ConsumptionLog;
}

function harness(): Harness {
	const db = new Database(":memory:");
	const store = createDataStore(db);
	const catalog = createFoodCatalog(store);
	const log = createConsumptionLog(store);
	return { app: createFoodsRoutes(catalog), catalog, log };
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

describe("POST /foods/:id/delete", () => {
	it("hard-deletes an unreferenced Food and redirects to /foods", async () => {
		const { app, catalog } = harness();
		const food = catalog.createFood(OATMEAL);

		const res = await app.request(`/${food.id}/delete`, formPost({}));

		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/foods");
		expect(catalog.getFood(food.id)).toBeUndefined();
		expect(catalog.listActiveFoods()).toHaveLength(0);
	});

	it("archives a referenced Food and redirects back to the view", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood(OATMEAL);
		log.logConsumption("2025-01-01", food.id, 100);

		const res = await app.request(`/${food.id}/delete`, formPost({}));

		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(`/foods/${food.id}`);
		const archived = catalog.getFood(food.id);
		expect(archived).toBeDefined();
		expect(archived?.archived).toBe(true);
		expect(catalog.listActiveFoods()).toHaveLength(0);
	});

	it("responds 404 for an unknown Food id", async () => {
		const { app } = harness();
		const res = await app.request("/nope/delete", formPost({}));
		expect(res.status).toBe(404);
	});
});

describe("GET /foods/:id/delete — confirmation", () => {
	it("warns that history will be affected when the Food is referenced", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood(OATMEAL);
		log.logConsumption("2025-01-01", food.id, 100);

		const res = await app.request(`/${food.id}/delete`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("history");
		expect(html).toContain("archive");
		expect(html).toContain(`/foods/${food.id}/delete`);
		expect(html).toContain("/foods");
	});

	it("states a permanent delete when the Food is unreferenced", async () => {
		const { app, catalog } = harness();
		const food = catalog.createFood(OATMEAL);

		const res = await app.request(`/${food.id}/delete`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("permanently");
		expect(html).toContain(`/foods/${food.id}/delete`);
	});

	it("responds 404 for an unknown Food id", async () => {
		const { app } = harness();
		const res = await app.request("/nope/delete");
		expect(res.status).toBe(404);
	});
});

describe("GET /foods/:id/edit — history warning", () => {
	it("shows a history-will-change banner when the Food is referenced", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood(OATMEAL);
		log.logConsumption("2025-01-01", food.id, 100);

		const res = await app.request(`/${food.id}/edit`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("history");
		expect(html).toContain("past");
	});

	it("omits the banner when the Food is unreferenced", async () => {
		const { app, catalog } = harness();
		const food = catalog.createFood(OATMEAL);

		const res = await app.request(`/${food.id}/edit`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).not.toContain("history-will-change");
	});
});

describe("GET /foods/:id — archived badge", () => {
	it("shows an archived badge after deleteFood archives the Food", async () => {
		const { app, catalog, log } = harness();
		const food = catalog.createFood(OATMEAL);
		log.logConsumption("2025-01-01", food.id, 100);
		catalog.deleteFood(food.id);

		const res = await app.request(`/${food.id}`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Archived");
	});

	it("responds 404 after a hard-deleted Food is gone", async () => {
		const { app, catalog } = harness();
		const food = catalog.createFood(OATMEAL);
		catalog.deleteFood(food.id);

		const res = await app.request(`/${food.id}`);
		expect(res.status).toBe(404);
	});
});
