import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

type SqliteDatabase = InstanceType<typeof Database>;

import { count, eq, like } from "drizzle-orm";
import type { LogEntry, LogEntryId } from "../modules/consumption-log.types.js";
import type {
	Food,
	FoodId,
	Nutrition,
	ReferencePortion,
} from "../modules/food-catalog.types.js";
import { foods, logEntries } from "./schema.js";

function rowToFood(row: typeof foods.$inferSelect): Food {
	return {
		id: row.id,
		name: row.name,
		referencePortion: {
			value: row.referenceValue,
			unit: row.referenceUnit as ReferencePortion["unit"],
		},
		nutrition: {
			calories: row.calories,
			protein: row.protein,
			carbs: row.carbs,
			fat: row.fat,
			fiber: row.fiber,
			sugar: row.sugar,
			sodium: row.sodium,
		},
		archived: row.archived,
	};
}

export interface DataStore {
	insertFood(food: {
		id: FoodId;
		name: string;
		referencePortion: ReferencePortion;
		nutrition: Nutrition;
		archived: boolean;
	}): Food;
	updateFood(
		id: FoodId,
		changes: Partial<{
			name: string;
			referencePortion: ReferencePortion;
			nutrition: Nutrition;
			archived: boolean;
		}>,
	): Food | undefined;
	findActiveFoods(nameQuery?: string): Food[];
	findFoodById(id: FoodId): Food | undefined;
	countLogEntriesForFood(id: FoodId): number;
	deleteFood(id: FoodId): boolean;
	insertLogEntry(entry: {
		id: LogEntryId;
		date: string;
		foodId: FoodId;
		quantity: number;
	}): LogEntry;
	updateLogEntry(id: LogEntryId, quantity: number): LogEntry | undefined;
	deleteLogEntry(id: LogEntryId): void;
	findEntriesByDate(date: string): LogEntry[];
}

function rowToLogEntry(row: typeof logEntries.$inferSelect): LogEntry {
	return {
		id: row.id,
		date: row.date,
		foodId: row.foodId,
		quantity: row.quantity,
	};
}

export function createDataStore(db: SqliteDatabase): DataStore {
	const orm = drizzle(db);

	// Enforce FK constraints so log_entries.food_id → foods.id is real.
	db.pragma("foreign_keys = ON");

	// Bootstrap schema
	db.exec(`
		CREATE TABLE IF NOT EXISTS foods (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			reference_value REAL NOT NULL,
			reference_unit TEXT NOT NULL,
			calories REAL NOT NULL,
			protein REAL NOT NULL,
			carbs REAL NOT NULL,
			fat REAL NOT NULL,
			fiber REAL NOT NULL,
			sugar REAL NOT NULL,
			sodium REAL NOT NULL,
			archived INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS log_entries (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			food_id TEXT NOT NULL,
			quantity REAL NOT NULL,
			FOREIGN KEY (food_id) REFERENCES foods(id)
		);
	`);

	return {
		insertFood(input) {
			orm
				.insert(foods)
				.values({
					id: input.id,
					name: input.name,
					referenceValue: input.referencePortion.value,
					referenceUnit: input.referencePortion.unit,
					calories: input.nutrition.calories,
					protein: input.nutrition.protein,
					carbs: input.nutrition.carbs,
					fat: input.nutrition.fat,
					fiber: input.nutrition.fiber,
					sugar: input.nutrition.sugar,
					sodium: input.nutrition.sodium,
					archived: input.archived,
				})
				.run();
			return rowToFood({
				id: input.id,
				name: input.name,
				referenceValue: input.referencePortion.value,
				referenceUnit: input.referencePortion.unit,
				calories: input.nutrition.calories,
				protein: input.nutrition.protein,
				carbs: input.nutrition.carbs,
				fat: input.nutrition.fat,
				fiber: input.nutrition.fiber,
				sugar: input.nutrition.sugar,
				sodium: input.nutrition.sodium,
				archived: input.archived,
			});
		},

		updateFood(id, changes) {
			const existing = orm.select().from(foods).where(eq(foods.id, id)).get();
			if (!existing) return undefined;

			const updateData: Record<string, unknown> = {};
			if (changes.name !== undefined) updateData.name = changes.name;
			if (changes.referencePortion) {
				updateData.referenceValue = changes.referencePortion.value;
				updateData.referenceUnit = changes.referencePortion.unit;
			}
			if (changes.nutrition) {
				updateData.calories = changes.nutrition.calories;
				updateData.protein = changes.nutrition.protein;
				updateData.carbs = changes.nutrition.carbs;
				updateData.fat = changes.nutrition.fat;
				updateData.fiber = changes.nutrition.fiber;
				updateData.sugar = changes.nutrition.sugar;
				updateData.sodium = changes.nutrition.sodium;
			}
			if (changes.archived !== undefined)
				updateData.archived = changes.archived;

			if (Object.keys(updateData).length > 0) {
				orm.update(foods).set(updateData).where(eq(foods.id, id)).run();
			}

			const updated = orm.select().from(foods).where(eq(foods.id, id)).get();
			return updated ? rowToFood(updated) : undefined;
		},

		findActiveFoods(nameQuery) {
			const trimmed = nameQuery?.trim();
			if (trimmed) {
				return orm
					.select()
					.from(foods)
					.where(like(foods.name, `%${trimmed}%`))
					.all()
					.filter((r) => !r.archived)
					.map(rowToFood);
			}
			return orm
				.select()
				.from(foods)
				.all()
				.filter((r) => !r.archived)
				.map(rowToFood);
		},

		findFoodById(id) {
			const row = orm.select().from(foods).where(eq(foods.id, id)).get();
			return row ? rowToFood(row) : undefined;
		},

		countLogEntriesForFood(id) {
			const row = orm
				.select({ value: count() })
				.from(logEntries)
				.where(eq(logEntries.foodId, id))
				.get();
			return row?.value ?? 0;
		},

		deleteFood(id) {
			const result = orm.delete(foods).where(eq(foods.id, id)).run();
			return result.changes > 0;
		},

		insertLogEntry(input) {
			orm
				.insert(logEntries)
				.values({
					id: input.id,
					date: input.date,
					foodId: input.foodId,
					quantity: input.quantity,
				})
				.run();
			return rowToLogEntry({
				id: input.id,
				date: input.date,
				foodId: input.foodId,
				quantity: input.quantity,
			});
		},

		updateLogEntry(id, quantity) {
			const existing = orm
				.select()
				.from(logEntries)
				.where(eq(logEntries.id, id))
				.get();
			if (!existing) return undefined;
			orm
				.update(logEntries)
				.set({ quantity })
				.where(eq(logEntries.id, id))
				.run();
			const updated = orm
				.select()
				.from(logEntries)
				.where(eq(logEntries.id, id))
				.get();
			return updated ? rowToLogEntry(updated) : undefined;
		},

		deleteLogEntry(id) {
			orm.delete(logEntries).where(eq(logEntries.id, id)).run();
		},

		findEntriesByDate(date) {
			return orm
				.select()
				.from(logEntries)
				.where(eq(logEntries.date, date))
				.all()
				.map(rowToLogEntry);
		},
	};
}
