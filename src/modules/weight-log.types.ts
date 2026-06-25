import type { IsoDate } from "./consumption-log.types.js";
import type { WeightUnit } from "./units.js";

export type { IsoDate } from "./consumption-log.types.js";
export type { WeightUnit } from "./units.js";

/**
 * A single per-day body-weight reading, returned in the unit the caller
 * requested. Storage is always kilograms; this is the domain projection.
 */
export interface WeightReading {
	date: IsoDate;
	value: number;
	unit: WeightUnit;
}

/**
 * Weight log (ADR 0002): owns the single per-day body-weight measurement,
 * stored canonically in kilograms. `recordWeight` accepts kg or lb and
 * converts to kg for storage; a second record for the same day overwrites
 * the first. `getWeight` returns the value in the requested unit, or
 * `undefined` when no weight is recorded for the day.
 */
export interface WeightLog {
	recordWeight(date: IsoDate, value: number, unit: WeightUnit): WeightReading;
	getWeight(date: IsoDate, unit: WeightUnit): WeightReading | undefined;
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}
