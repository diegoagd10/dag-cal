import type { DataStore } from "../data/store.js";
import type { IsoDate, WeightLog } from "./weight-log.types.js";

export type { WeightLog, WeightReading } from "./weight-log.types.js";
export { ValidationError } from "./weight-log.types.js";

import type { WeightUnit } from "./units.js";
import { kgToLb, lbToKg } from "./units.js";
import { ValidationError } from "./weight-log.types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validateIsoDate(date: unknown): asserts date is string {
	if (typeof date !== "string" || !ISO_DATE.test(date)) {
		throw new ValidationError("date must be a YYYY-MM-DD string");
	}
}

function validateValue(value: unknown): asserts value is number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new ValidationError("value must be a positive finite number");
	}
}

function validateUnit(unit: unknown): asserts unit is WeightUnit {
	if (unit !== "kg" && unit !== "lb") {
		throw new ValidationError("unit must be kg or lb");
	}
}

/** Convert a value in the requested unit to canonical kilograms. */
function toKilograms(value: number, unit: WeightUnit): number {
	return unit === "kg" ? value : lbToKg(value);
}

/** Convert canonical kilograms to the requested display unit. */
function fromKilograms(kg: number, unit: WeightUnit): number {
	return unit === "kg" ? kg : kgToLb(kg);
}

/**
 * Weight log (ADR 0002): canonical kilogram storage with a single per-day
 * measurement. Callers ask in kg or lb; the module converts and hides the
 * unit, so switching display units never corrupts stored history. A day
 * with no recorded weight reads `undefined`, never zero.
 */
export function createWeightLog(store: DataStore): WeightLog {
	return {
		recordWeight(date, value, unit) {
			validateIsoDate(date);
			validateValue(value);
			validateUnit(unit);

			const kilograms = toKilograms(value, unit);
			store.upsertWeight(date as IsoDate, kilograms);
			return { date: date as IsoDate, value, unit };
		},

		getWeight(date, unit) {
			validateIsoDate(date);
			validateUnit(unit);

			const kilograms = store.findWeightByDate(date as IsoDate);
			if (kilograms === undefined) return undefined;
			return {
				date: date as IsoDate,
				value: fromKilograms(kilograms, unit),
				unit,
			};
		},
	};
}
