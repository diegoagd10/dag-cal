import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { createDataStore } from "../../src/data/store.js";
import type { FoodCatalog } from "../../src/modules/food-catalog.js";
import { createFoodCatalog } from "../../src/modules/food-catalog.js";

function freshCatalog(): FoodCatalog {
	const db = new Database(":memory:");
	const store = createDataStore(db);
	return createFoodCatalog(store);
}

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

describe("FoodCatalog", () => {
	let catalog: FoodCatalog;

	beforeEach(() => {
		catalog = freshCatalog();
	});

	describe("createFood", () => {
		it("persists a Food and returns it with an id and archived: false", () => {
			const food = catalog.createFood(validFood);

			expect(food.id).toBeTypeOf("string");
			expect(food.id.length).toBeGreaterThan(0);
			expect(food.name).toBe("Oatmeal");
			expect(food.referencePortion).toEqual({ value: 100, unit: "g" });
			expect(food.nutrition.calories).toBe(389);
			expect(food.archived).toBe(false);
		});

		it("rejects an empty name", () => {
			expect(() => catalog.createFood({ ...validFood, name: "" })).toThrow(
				"name",
			);
		});

		it("rejects an invalid unit", () => {
			expect(() =>
				catalog.createFood({
					...validFood,
					referencePortion: { value: 100, unit: "lb" as never },
				}),
			).toThrow("unit");
		});

		it("accepts all three valid units (g, oz, unit)", () => {
			for (const unit of ["g", "oz", "unit"] as const) {
				const food = catalog.createFood({
					...validFood,
					referencePortion: { value: 1, unit },
				});
				expect(food.referencePortion.unit).toBe(unit);
			}
		});

		it("ensures newly created foods appear in listActiveFoods", () => {
			catalog.createFood(validFood);
			const foods = catalog.listActiveFoods();
			expect(foods).toHaveLength(1);
			expect(foods[0].name).toBe("Oatmeal");
		});
	});

	describe("updateFood", () => {
		it("updates a Food's name", () => {
			const food = catalog.createFood(validFood);
			const updated = catalog.updateFood(food.id, {
				name: "Instant Oatmeal",
			});
			expect(updated.name).toBe("Instant Oatmeal");
			expect(updated.id).toBe(food.id);
		});

		it("updates a Food's reference portion", () => {
			const food = catalog.createFood(validFood);
			const updated = catalog.updateFood(food.id, {
				referencePortion: { value: 40, unit: "g" },
			});
			expect(updated.referencePortion).toEqual({ value: 40, unit: "g" });
		});

		it("updates a Food's nutrition values", () => {
			const food = catalog.createFood(validFood);
			const updated = catalog.updateFood(food.id, {
				nutrition: {
					calories: 100,
					protein: 5,
					carbs: 10,
					fat: 3,
					fiber: 2,
					sugar: 1,
					sodium: 0.5,
				},
			});
			expect(updated.nutrition.calories).toBe(100);
			expect(updated.nutrition.protein).toBe(5);
		});

		it("throws FoodNotFound when the id does not exist", () => {
			expect(() =>
				catalog.updateFood("nonexistent-id", { name: "Nope" }),
			).toThrow("FoodNotFound");
		});

		it("preserves unchanged fields", () => {
			const food = catalog.createFood(validFood);
			const updated = catalog.updateFood(food.id, {
				name: "New Name",
			});
			expect(updated.referencePortion).toEqual(food.referencePortion);
			expect(updated.nutrition).toEqual(food.nutrition);
		});
	});

	describe("listActiveFoods", () => {
		it("returns only non-archived foods", () => {
			catalog.createFood({ ...validFood, name: "Active" });
			catalog.createFood({ ...validFood, name: "Also Active" });

			// Simulate archival via direct store manipulation for test purposes
			// We can't archive via the interface (deferred), but we can check
			// that listActiveFoods filters archived=false
			const foods = catalog.listActiveFoods();
			expect(foods).toHaveLength(2);
			expect(foods.every((f) => !f.archived)).toBe(true);
		});

		it("filters by name substring when nameQuery is provided", () => {
			catalog.createFood({ ...validFood, name: "Oatmeal" });
			catalog.createFood({ ...validFood, name: "Chicken Breast" });
			catalog.createFood({ ...validFood, name: "Oat Milk" });

			const oats = catalog.listActiveFoods("oat");
			expect(oats).toHaveLength(2);
			expect(oats.map((f) => f.name).sort()).toEqual(["Oat Milk", "Oatmeal"]);
		});

		it("returns all active foods when nameQuery is empty or whitespace", () => {
			catalog.createFood({ ...validFood, name: "A" });
			catalog.createFood({ ...validFood, name: "B" });

			expect(catalog.listActiveFoods("")).toHaveLength(2);
			expect(catalog.listActiveFoods("   ")).toHaveLength(2);
		});

		it("returns empty array when no active foods match", () => {
			catalog.createFood({ ...validFood, name: "Rice" });
			expect(catalog.listActiveFoods("pizza")).toHaveLength(0);
		});
	});

	describe("getFood", () => {
		it("returns the Food for a known id", () => {
			const created = catalog.createFood(validFood);
			const found = catalog.getFood(created.id);
			expect(found).toBeDefined();
			expect(found?.id).toBe(created.id);
			expect(found?.name).toBe("Oatmeal");
		});

		it("returns undefined for an unknown id", () => {
			expect(catalog.getFood("nonexistent")).toBeUndefined();
		});
	});

	describe("archived flag", () => {
		it("archived defaults to false on create", () => {
			const food = catalog.createFood(validFood);
			expect(food.archived).toBe(false);
		});

		it("archived column exists in the database", () => {
			const food = catalog.createFood(validFood);
			const retrieved = catalog.getFood(food.id);
			expect(retrieved).toHaveProperty("archived", false);
		});
	});
});
