import type { DataStore } from "../data/store.js";
import type { DaySnapshotReader, SnapshotEntry } from "./day-snapshot.types.js";
import type { Food, Nutrition } from "./food-catalog.types.js";

/**
 * Day-snapshot module (ADR 0002): composes a date's log entries into a
 * derived, never-persisted view — per-entry contributed macros plus a day
 * total. Nutrition math (entryMacros / sumMacros) is colocated here as the
 * sole consumer in this slice; unit conversions live in units.ts.
 */
export function createDaySnapshot(store: DataStore): DaySnapshotReader {
	return {
		getDaySnapshot(date) {
			const entries = store.findEntriesByDate(date);
			const snapshotEntries: SnapshotEntry[] = [];
			const totals = zeroNutrition();

			for (const entry of entries) {
				// FK should prevent a missing Food; skip defensively on corrupted DB.
				const food = store.findFoodById(entry.foodId);
				if (!food) continue;

				const macros = entryMacros(food, entry.quantity);
				snapshotEntries.push({ entry, food, macros });
				addInto(totals, macros);
			}

			return {
				date,
				totals,
				entries: snapshotEntries,
				water: { ounces: store.findWaterByDate(date) ?? 0 },
			};
		},
	};
}

const NUTRITION_KEYS = [
	"calories",
	"protein",
	"carbs",
	"fat",
	"fiber",
	"sugar",
	"sodium",
] as const satisfies (keyof Nutrition)[];

export function zeroNutrition(): Nutrition {
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

/**
 * Each entry's macros: Food values × (quantity / reference portion value).
 * Pure; no I/O. Throws on a non-positive reference value to avoid divide-by-zero
 * — catalog validation prevents this in normal flow, so this is a defensive guard.
 */
export function entryMacros(food: Food, quantity: number): Nutrition {
	const ref = food.referencePortion.value;
	if (!(ref > 0) || !Number.isFinite(ref)) {
		throw new Error(
			`referencePortion.value must be a positive finite number (food "${food.id}")`,
		);
	}
	const ratio = quantity / ref;
	const n = food.nutrition;
	return {
		calories: n.calories * ratio,
		protein: n.protein * ratio,
		carbs: n.carbs * ratio,
		fat: n.fat * ratio,
		fiber: n.fiber * ratio,
		sugar: n.sugar * ratio,
		sodium: n.sodium * ratio,
	};
}

/** Component-wise sum over an iterable of Nutrition values. */
export function sumMacros(parts: Iterable<Nutrition>): Nutrition {
	const totals = zeroNutrition();
	for (const part of parts) addInto(totals, part);
	return totals;
}

function addInto(target: Nutrition, part: Nutrition): void {
	for (const key of NUTRITION_KEYS) {
		target[key] += part[key];
	}
}
